-- CreateEnum
CREATE TYPE "SwapStatus" AS ENUM ('PENDING_ACCEPT', 'PENDING_APPROVAL', 'HARD_RULE_REJECTED', 'DECLINED', 'APPROVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SwapRequest" (
    "id" TEXT NOT NULL,
    "rosterId" TEXT NOT NULL,
    "requestingAssignmentId" TEXT NOT NULL,
    "acceptingAssignmentId" TEXT,
    "status" "SwapStatus" NOT NULL DEFAULT 'PENDING_ACCEPT',
    "proposedEvaluation" JSONB,
    "note" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SwapRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_requestingAssignmentId_fkey" FOREIGN KEY ("requestingAssignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_acceptingAssignmentId_fkey" FOREIGN KEY ("acceptingAssignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

