import { prisma } from "@/lib/db";
import { DAY_OFF } from "./types";

/**
 * Recompute StaffDailyCommitment rows for one roster from its assignments.
 *
 * Wards are rostered independently, so this table is what makes cross-ward
 * double-booking visible and, at the database level, unrecordable: a unique
 * index on (staffId, date) means one person can hold at most one commitment on
 * a given calendar day.
 *
 * Only PUBLISHED rosters commit anyone. A draft is a proposal — planners
 * routinely draft alternatives for the same period, and letting drafts hold a
 * person's day would make those alternatives collide with each other rather
 * than with reality. Drafts are still checked against other wards' published
 * commitments when evaluated, so a real clash shows up before publishing.
 *
 * A clash does not fail the save: the assignment stands and the clash surfaces
 * as a violation, consistent with every other rule, and avoids a half-written
 * roster. The number of skipped rows is returned so callers can report it.
 *
 * Call after any write that changes a roster's assignments or its status.
 */
export async function syncRosterCommitments(rosterId: string): Promise<{ skipped: number }> {
  const roster = await prisma.roster.findUnique({
    where: { id: rosterId },
    include: { assignments: true },
  });
  if (!roster) return { skipped: 0 };

  if (roster.status !== "PUBLISHED") {
    await prisma.staffDailyCommitment.deleteMany({ where: { rosterId } });
    return { skipped: 0 };
  }

  const working = roster.assignments.filter((a) => a.shift !== DAY_OFF);
  const rows = working.map((a) => ({
    staffId: a.staffId,
    date: addDays(roster.startDate, a.dayIndex),
    wardId: roster.wardId,
    rosterId: roster.id,
    assignmentId: a.id,
    shiftCode: a.shift,
  }));

  // Replace this roster's own rows, then insert what fits. skipDuplicates drops
  // any day the person is already committed to another ward.
  await prisma.staffDailyCommitment.deleteMany({ where: { rosterId } });
  const created =
    rows.length > 0
      ? await prisma.staffDailyCommitment.createMany({ data: rows, skipDuplicates: true })
      : { count: 0 };

  return { skipped: rows.length - created.count };
}

/** Midnight on the given calendar date, `n` days after `from`. */
export function addDays(from: Date, n: number): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + n);
  return d;
}
