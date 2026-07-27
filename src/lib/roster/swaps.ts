import { prisma } from "@/lib/db";
import { loadChargeLeads } from "./charge-leads";
import { evaluate } from "./engine";
import { loadSolverInput } from "./load";
import { CellValue, DAY_OFF, Evaluation, Grid, Violation } from "./types";

export interface SwapCheck {
  /** True when the exchange introduces no new hard violation. */
  allowed: boolean;
  before: Evaluation;
  after: Evaluation;
  /** Hard violations the swap would add — the reason when it isn't allowed. */
  newViolations: Violation[];
}

/**
 * Work out what a proposed exchange would do to a roster.
 *
 * The two assignments trade shifts — which covers a straight swap, and also
 * giving a shift away, since the other side may be a day off.
 *
 * Deliberately no rules of its own: it rebuilds the roster's grid, applies the
 * exchange to a copy, and runs the same evaluate() the solver and the roster
 * page use. Anything that would be a violation when generating is a violation
 * here, automatically and for ever.
 */
export async function checkSwap(
  rosterId: string,
  offeredAssignmentId: string,
  acceptedAssignmentId: string,
): Promise<SwapCheck | null> {
  const roster = await prisma.roster.findUnique({
    where: { id: rosterId },
    include: { assignments: true },
  });
  if (!roster) return null;

  const offered = roster.assignments.find((a) => a.id === offeredAssignmentId);
  const accepted = roster.assignments.find((a) => a.id === acceptedAssignmentId);
  if (!offered || !accepted) return null;

  const input = await loadSolverInput(roster.wardId, roster.startDate, roster.days);
  input.chargeLeads = await loadChargeLeads(rosterId);

  // The grid the roster page shows: rows follow input.staff order, and anyone
  // with assignments but no longer in the ward simply isn't represented.
  const rowOf = new Map(input.staff.map((s, i) => [s.id, i]));
  const grid: Grid = input.staff.map(() => Array<CellValue>(roster.days).fill(DAY_OFF));
  for (const a of roster.assignments) {
    const row = rowOf.get(a.staffId);
    if (row !== undefined && a.dayIndex < roster.days) grid[row][a.dayIndex] = a.shift;
  }

  const before = evaluate(input, grid);

  const offeredRow = rowOf.get(offered.staffId);
  const acceptedRow = rowOf.get(accepted.staffId);
  if (offeredRow === undefined || acceptedRow === undefined) return null;

  const proposed = grid.map((row) => [...row]);
  proposed[offeredRow][offered.dayIndex] = accepted.shift;
  proposed[acceptedRow][accepted.dayIndex] = offered.shift;
  const after = evaluate(input, proposed);

  // Compare the actual violations, not just the count: a swap that trades one
  // breach for another leaves the count unchanged but is still not acceptable.
  const key = (v: Violation) => `${v.type}|${v.staffId ?? ""}|${v.dayIndexes.join(",")}`;
  const had = new Set(before.violations.filter((v) => v.severity === "HARD").map(key));
  const newViolations = after.violations.filter(
    (v) => v.severity === "HARD" && !had.has(key(v)),
  );

  return { allowed: newViolations.length === 0, before, after, newViolations };
}

/** Exchange the two assignments' shifts. Callers re-sync commitments afterwards. */
export async function applySwap(
  offeredAssignmentId: string,
  acceptedAssignmentId: string,
): Promise<void> {
  const [offered, accepted] = await Promise.all([
    prisma.assignment.findUnique({ where: { id: offeredAssignmentId } }),
    prisma.assignment.findUnique({ where: { id: acceptedAssignmentId } }),
  ]);
  if (!offered || !accepted) return;

  await prisma.$transaction([
    prisma.assignment.update({
      where: { id: offered.id },
      data: { shift: accepted.shift },
    }),
    prisma.assignment.update({
      where: { id: accepted.id },
      data: { shift: offered.shift },
    }),
  ]);
}
