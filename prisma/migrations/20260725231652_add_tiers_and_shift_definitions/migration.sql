-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "canBeLead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fte" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "tierId" TEXT;

-- CreateTable
CREATE TABLE "ShiftDefinition" (
    "id" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "crossesMidnight" BOOLEAN NOT NULL DEFAULT false,
    "isNightLike" BOOLEAN NOT NULL DEFAULT false,
    "payrollTag" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ShiftDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffTier" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "countsTowardClinicalCoverage" BOOLEAN NOT NULL DEFAULT true,
    "maxConsecutiveNights" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TierShiftEligibility" (
    "id" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "shiftDefId" TEXT NOT NULL,
    "eligible" BOOLEAN NOT NULL DEFAULT true,
    "weekendEligible" BOOLEAN NOT NULL DEFAULT true,
    "holidayEligible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TierShiftEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TierPairingRule" (
    "id" TEXT NOT NULL,
    "dependentTierId" TEXT NOT NULL,
    "requiredTierId" TEXT NOT NULL,
    "minRequiredCount" INTEGER NOT NULL DEFAULT 1,
    "shiftDefId" TEXT,

    CONSTRAINT "TierPairingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShiftDefinition_wardId_code_key" ON "ShiftDefinition"("wardId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "StaffTier_hospitalId_name_key" ON "StaffTier"("hospitalId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TierShiftEligibility_tierId_shiftDefId_key" ON "TierShiftEligibility"("tierId", "shiftDefId");

-- CreateIndex
CREATE UNIQUE INDEX "TierPairingRule_dependentTierId_requiredTierId_shiftDefId_key" ON "TierPairingRule"("dependentTierId", "requiredTierId", "shiftDefId");

-- AddForeignKey
ALTER TABLE "ShiftDefinition" ADD CONSTRAINT "ShiftDefinition_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTier" ADD CONSTRAINT "StaffTier_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TierShiftEligibility" ADD CONSTRAINT "TierShiftEligibility_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "StaffTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TierShiftEligibility" ADD CONSTRAINT "TierShiftEligibility_shiftDefId_fkey" FOREIGN KEY ("shiftDefId") REFERENCES "ShiftDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TierPairingRule" ADD CONSTRAINT "TierPairingRule_dependentTierId_fkey" FOREIGN KEY ("dependentTierId") REFERENCES "StaffTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TierPairingRule" ADD CONSTRAINT "TierPairingRule_requiredTierId_fkey" FOREIGN KEY ("requiredTierId") REFERENCES "StaffTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TierPairingRule" ADD CONSTRAINT "TierPairingRule_shiftDefId_fkey" FOREIGN KEY ("shiftDefId") REFERENCES "ShiftDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "StaffTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
