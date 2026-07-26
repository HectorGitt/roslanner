// One-time backfill: build StaffDailyCommitment rows for rosters that existed
// before cross-ward commitment tracking was added. Safe to re-run.
//
// Only PUBLISHED rosters commit staff — a draft is a proposal, so drafts for the
// same period shouldn't collide with each other. Where two published rosters
// already double-book someone on a date, only the first is recorded and the
// clash surfaces as a violation on the other, which is what a planner needs to
// see. Also clears any stale commitments left by drafts.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function addDays(from, n) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  // Drafts never hold commitments.
  const cleared = await prisma.staffDailyCommitment.deleteMany({
    where: { roster: { status: { not: "PUBLISHED" } } },
  });
  if (cleared.count > 0) console.log(`Cleared ${cleared.count} commitment(s) held by drafts.`);

  const rosters = await prisma.roster.findMany({
    where: { status: "PUBLISHED" },
    include: { assignments: true, _count: { select: { commitments: true } } },
    orderBy: { createdAt: "asc" },
  });

  let created = 0;
  let skipped = 0;
  for (const roster of rosters) {
    if (roster._count.commitments > 0) continue; // already tracked
    const rows = roster.assignments
      .filter((a) => a.shift !== "DO")
      .map((a) => ({
        staffId: a.staffId,
        date: addDays(roster.startDate, a.dayIndex),
        wardId: roster.wardId,
        rosterId: roster.id,
        assignmentId: a.id,
        shiftCode: a.shift,
      }));
    if (rows.length === 0) continue;
    const res = await prisma.staffDailyCommitment.createMany({
      data: rows,
      skipDuplicates: true,
    });
    created += res.count;
    skipped += rows.length - res.count;
  }
  console.log(`Commitments created: ${created}${skipped ? `, skipped as clashes: ${skipped}` : ""}`);
}

main().finally(() => prisma.$disconnect());
