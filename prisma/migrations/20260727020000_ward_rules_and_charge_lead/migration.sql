-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('BLOCK_PATTERN_ON_OFF', 'CHARGE_LEAD_REQUIRED', 'MAX_HOURS_PER_WEEK');

-- CreateTable
CREATE TABLE "WardRule" (
    "id" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "type" "RuleType" NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "tierId" TEXT,
    "shiftCode" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WardRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeLeadAssignment" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "rosterId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "shiftCode" TEXT NOT NULL,

    CONSTRAINT "ChargeLeadAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChargeLeadAssignment_assignmentId_key" ON "ChargeLeadAssignment"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ChargeLeadAssignment_rosterId_dayIndex_shiftCode_key" ON "ChargeLeadAssignment"("rosterId", "dayIndex", "shiftCode");

-- AddForeignKey
ALTER TABLE "WardRule" ADD CONSTRAINT "WardRule_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WardRule" ADD CONSTRAINT "WardRule_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "StaffTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeLeadAssignment" ADD CONSTRAINT "ChargeLeadAssignment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeLeadAssignment" ADD CONSTRAINT "ChargeLeadAssignment_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

