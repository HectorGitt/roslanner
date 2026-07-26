-- Phase 2: ward-level shift models, tier-scoped coverage, real rest-hours rule.

-- Ward gains a free-text category label and a cycle length (7-day weekly vs
-- 30-day monthly stretch). Defaults reproduce today's behaviour exactly.
ALTER TABLE "Ward" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'Standard',
ADD COLUMN     "cycleLengthDays" INTEGER NOT NULL DEFAULT 7;

-- Coverage can now be scoped by role, by tier, by both, or by neither.
-- Existing rows all have roleId set and tierId null, so they keep working.
DROP INDEX "CoverageRequirement_wardId_shift_roleId_key";
ALTER TABLE "CoverageRequirement" ADD COLUMN     "tierId" TEXT,
ALTER COLUMN "roleId" DROP NOT NULL;
CREATE UNIQUE INDEX "CoverageRequirement_wardId_shift_roleId_tierId_key" ON "CoverageRequirement"("wardId", "shift", "roleId", "tierId");
ALTER TABLE "CoverageRequirement" ADD CONSTRAINT "CoverageRequirement_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "StaffTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Replace the noMorningAfterNight boolean with a configurable rest-hours
-- threshold, preserving each ward's existing choice: wards that enforced the
-- rule get 8h (the gap the old rule effectively required between a night
-- ending at 08:00 and a morning starting at 08:00), wards that had it off get
-- NULL (unenforced).
ALTER TABLE "RuleSet" ADD COLUMN "minRestHours" INTEGER DEFAULT 8;
UPDATE "RuleSet" SET "minRestHours" = NULL WHERE "noMorningAfterNight" = false;
ALTER TABLE "RuleSet" DROP COLUMN "noMorningAfterNight";
