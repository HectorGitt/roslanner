import { prisma } from "@/lib/db";
import { ChargeLead } from "./types";

/**
 * Replace a roster's designated shift leads.
 *
 * Stored against the assignment, so a lead disappears automatically if that
 * person's shift is deleted, and the unique key on (roster, day, shift) is what
 * keeps "exactly one in charge" true in the database rather than only in code.
 */
export async function saveChargeLeads(rosterId: string, leads: ChargeLead[]): Promise<void> {
  await prisma.chargeLeadAssignment.deleteMany({ where: { rosterId } });
  if (leads.length === 0) return;

  const assignments = await prisma.assignment.findMany({
    where: { rosterId },
    select: { id: true, staffId: true, dayIndex: true, shift: true },
  });
  const idOf = new Map(
    assignments.map((a) => [`${a.staffId}|${a.dayIndex}|${a.shift}`, a.id]),
  );

  const rows = leads
    .map((l) => ({
      assignmentId: idOf.get(`${l.staffId}|${l.dayIndex}|${l.shiftCode}`),
      rosterId,
      dayIndex: l.dayIndex,
      shiftCode: l.shiftCode,
    }))
    .filter((r): r is { assignmentId: string; rosterId: string; dayIndex: number; shiftCode: string } =>
      Boolean(r.assignmentId),
    );
  if (rows.length > 0) {
    await prisma.chargeLeadAssignment.createMany({ data: rows, skipDuplicates: true });
  }
}

/** A roster's stored leads, in the shape the engine expects. */
export async function loadChargeLeads(rosterId: string): Promise<ChargeLead[]> {
  const rows = await prisma.chargeLeadAssignment.findMany({
    where: { rosterId },
    include: { assignment: { select: { staffId: true } } },
  });
  return rows.map((r) => ({
    staffId: r.assignment.staffId,
    dayIndex: r.dayIndex,
    shiftCode: r.shiftCode,
  }));
}
