-- DropIndex
DROP INDEX "CoverageRequirement_wardId_shift_roleId_tierId_holidayRule_key";

-- DropIndex
DROP INDEX "RuleSet_wardId_key";

-- DropIndex
DROP INDEX "ShiftDefinition_wardId_code_key";

-- AlterTable
ALTER TABLE "CoverageRequirement" ADD COLUMN     "groupId" TEXT;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "groupId" TEXT;

-- AlterTable
ALTER TABLE "Roster" ADD COLUMN     "groupId" TEXT;

-- AlterTable
ALTER TABLE "RuleSet" ADD COLUMN     "groupId" TEXT;

-- AlterTable
ALTER TABLE "ShiftDefinition" ADD COLUMN     "groupId" TEXT;

-- AlterTable
ALTER TABLE "WardRule" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "StaffGroup" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StaffGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffGroup_hospitalId_name_key" ON "StaffGroup"("hospitalId", "name");

-- CreateIndex
CREATE INDEX "CoverageRequirement_wardId_groupId_idx" ON "CoverageRequirement"("wardId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "RuleSet_wardId_groupId_key" ON "RuleSet"("wardId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftDefinition_wardId_groupId_code_key" ON "ShiftDefinition"("wardId", "groupId", "code");

-- AddForeignKey
ALTER TABLE "ShiftDefinition" ADD CONSTRAINT "ShiftDefinition_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StaffGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffGroup" ADD CONSTRAINT "StaffGroup_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StaffGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageRequirement" ADD CONSTRAINT "CoverageRequirement_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StaffGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleSet" ADD CONSTRAINT "RuleSet_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StaffGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WardRule" ADD CONSTRAINT "WardRule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StaffGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roster" ADD CONSTRAINT "Roster_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StaffGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
