-- CreateTable
CREATE TABLE "StaffWardEligibility" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffWardEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffDailyCommitment" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "wardId" TEXT NOT NULL,
    "rosterId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "shiftCode" TEXT NOT NULL,

    CONSTRAINT "StaffDailyCommitment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffWardEligibility_staffId_wardId_key" ON "StaffWardEligibility"("staffId", "wardId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffDailyCommitment_assignmentId_key" ON "StaffDailyCommitment"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffDailyCommitment_staffId_date_key" ON "StaffDailyCommitment"("staffId", "date");

-- AddForeignKey
ALTER TABLE "StaffWardEligibility" ADD CONSTRAINT "StaffWardEligibility_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffWardEligibility" ADD CONSTRAINT "StaffWardEligibility_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDailyCommitment" ADD CONSTRAINT "StaffDailyCommitment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDailyCommitment" ADD CONSTRAINT "StaffDailyCommitment_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDailyCommitment" ADD CONSTRAINT "StaffDailyCommitment_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDailyCommitment" ADD CONSTRAINT "StaffDailyCommitment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

