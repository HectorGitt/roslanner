-- DropIndex
DROP INDEX "CoverageRequirement_wardId_shift_roleId_tierId_key";

-- AlterTable
ALTER TABLE "CoverageRequirement" ADD COLUMN     "daysOfWeek" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "holidayRule" TEXT NOT NULL DEFAULT 'SAME';

-- CreateIndex
CREATE UNIQUE INDEX "CoverageRequirement_wardId_shift_roleId_tierId_holidayRule_key" ON "CoverageRequirement"("wardId", "shift", "roleId", "tierId", "holidayRule");

