-- Re-key tier shift rules from a ward's ShiftDefinition row to the shift *code*,
-- so one rule applies hospital-wide instead of needing re-entry per ward.
-- Existing rows are preserved: their shiftDefId is resolved to that shift's code,
-- and rows that collapse together (same tier + code across different wards) are
-- folded with AND so any restriction survives rather than being lost.

-- === TierShiftEligibility ===
ALTER TABLE "TierShiftEligibility" ADD COLUMN "shiftCode" TEXT;

UPDATE "TierShiftEligibility" e
SET "shiftCode" = sd."code"
FROM "ShiftDefinition" sd
WHERE sd."id" = e."shiftDefId";

-- Fold duplicates onto the surviving row (most restrictive wins).
UPDATE "TierShiftEligibility" t
SET "eligible" = agg."eligible",
    "weekendEligible" = agg."weekendEligible",
    "holidayEligible" = agg."holidayEligible"
FROM (
  SELECT MIN("id") AS keep_id,
         bool_and("eligible") AS "eligible",
         bool_and("weekendEligible") AS "weekendEligible",
         bool_and("holidayEligible") AS "holidayEligible"
  FROM "TierShiftEligibility"
  WHERE "shiftCode" IS NOT NULL
  GROUP BY "tierId", "shiftCode"
) agg
WHERE t."id" = agg.keep_id;

DELETE FROM "TierShiftEligibility"
WHERE "shiftCode" IS NULL
   OR "id" NOT IN (
     SELECT MIN("id") FROM "TierShiftEligibility"
     WHERE "shiftCode" IS NOT NULL
     GROUP BY "tierId", "shiftCode"
   );

ALTER TABLE "TierShiftEligibility" ALTER COLUMN "shiftCode" SET NOT NULL;
ALTER TABLE "TierShiftEligibility" DROP CONSTRAINT "TierShiftEligibility_shiftDefId_fkey";
DROP INDEX "TierShiftEligibility_tierId_shiftDefId_key";
ALTER TABLE "TierShiftEligibility" DROP COLUMN "shiftDefId";
CREATE UNIQUE INDEX "TierShiftEligibility_tierId_shiftCode_key" ON "TierShiftEligibility"("tierId", "shiftCode");

-- === TierPairingRule ===
ALTER TABLE "TierPairingRule" ADD COLUMN "shiftCode" TEXT;

UPDATE "TierPairingRule" p
SET "shiftCode" = sd."code"
FROM "ShiftDefinition" sd
WHERE sd."id" = p."shiftDefId";

-- GROUP BY treats NULLs as equal, so this also clears any duplicate
-- all-shift rules that the old unique index could not prevent.
UPDATE "TierPairingRule" t
SET "minRequiredCount" = agg."minRequiredCount"
FROM (
  SELECT MIN("id") AS keep_id, MAX("minRequiredCount") AS "minRequiredCount"
  FROM "TierPairingRule"
  GROUP BY "dependentTierId", "requiredTierId", "shiftCode"
) agg
WHERE t."id" = agg.keep_id;

DELETE FROM "TierPairingRule"
WHERE "id" NOT IN (
  SELECT MIN("id") FROM "TierPairingRule"
  GROUP BY "dependentTierId", "requiredTierId", "shiftCode"
);

ALTER TABLE "TierPairingRule" DROP CONSTRAINT "TierPairingRule_shiftDefId_fkey";
DROP INDEX "TierPairingRule_dependentTierId_requiredTierId_shiftDefId_key";
ALTER TABLE "TierPairingRule" DROP COLUMN "shiftDefId";
CREATE UNIQUE INDEX "TierPairingRule_dependentTierId_requiredTierId_shiftCode_key" ON "TierPairingRule"("dependentTierId", "requiredTierId", "shiftCode");
