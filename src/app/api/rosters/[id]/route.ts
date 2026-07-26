import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncRosterCommitments } from "@/lib/roster/commitments";
import { evaluate } from "@/lib/roster/engine";
import { loadSolverInput, toISODate } from "@/lib/roster/load";
import { solve } from "@/lib/roster/solve";
import { requireHospitalUser } from "@/lib/session";
import { CellValue, DAY_OFF, Grid } from "@/lib/roster/types";

type Params = { params: Promise<{ id: string }> };

/** The roster, only if it belongs to this hospital. */
async function findOwnRoster(id: string, hospitalId: string) {
  return prisma.roster.findFirst({ where: { id, ward: { hospitalId } } });
}

async function buildRosterPayload(id: string) {
  const roster = await prisma.roster.findUnique({
    where: { id },
    include: { ward: true, assignments: true },
  });
  if (!roster) return null;

  const input = await loadSolverInput(roster.wardId, roster.startDate, roster.days);

  // Staff in the roster may include people since deactivated/removed from input —
  // index rows by the staff that actually have assignments, keeping input order first.
  const staffIds = input.staff.map((s) => s.id);
  const extraIds = [
    ...new Set(roster.assignments.map((a) => a.staffId).filter((sid) => !staffIds.includes(sid))),
  ];
  if (extraIds.length > 0) {
    const extras = await prisma.staff.findMany({
      where: { id: { in: extraIds } },
      include: { role: true, tier: true },
    });
    for (const e of extras) {
      input.staff.push({
        id: e.id,
        name: e.name,
        roleId: e.roleId,
        roleName: e.role.name,
        tierId: e.tierId ?? undefined,
        tierName: e.tier?.name,
        fte: e.fte,
        canBeLead: e.canBeLead,
      });
    }
  }

  const rowOf = new Map(input.staff.map((s, i) => [s.id, i]));
  const grid: Grid = input.staff.map(() =>
    Array<CellValue>(roster.days).fill(DAY_OFF),
  );
  for (const a of roster.assignments) {
    const row = rowOf.get(a.staffId);
    if (row !== undefined && a.dayIndex < roster.days) {
      grid[row][a.dayIndex] = a.shift as CellValue;
    }
  }

  const evaluation = evaluate(input, grid);

  return {
    id: roster.id,
    ward: roster.ward,
    startDate: toISODate(roster.startDate),
    days: roster.days,
    status: roster.status,
    staff: input.staff,
    offDays: input.offDays,
    coverage: input.coverage,
    rules: input.rules,
    tiers: input.tiers,
    tierPairings: input.tierPairings,
    shiftDefs: input.shiftDefs,
    externalShifts: input.externalShifts,
    homeWardId: input.homeWardId,
    floatStaffIds: input.floatStaffIds,
    publicHolidayDayIndexes: input.publicHolidayDayIndexes,
    priorStats: input.priorStats,
    grid,
    evaluation,
  };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { id } = await params;
  if (!(await findOwnRoster(id, guard.user.hospitalId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const payload = await buildRosterPayload(id);
  if (!payload) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(payload);
}

/**
 * Edit cells, re-optimize, or publish:
 * { edits: [{staffId, dayIndex, shift}] } and/or { reoptimize: true } and/or { status }.
 * Returns the refreshed roster payload with a new evaluation.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { id } = await params;
  const roster = await findOwnRoster(id, guard.user.hospitalId);
  if (!roster) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  let assignmentsChanged = false;

  if (Array.isArray(body.edits)) {
    assignmentsChanged = body.edits.length > 0;
    for (const e of body.edits) {
      await prisma.assignment.upsert({
        where: {
          rosterId_staffId_dayIndex: {
            rosterId: id,
            staffId: e.staffId,
            dayIndex: e.dayIndex,
          },
        },
        create: { rosterId: id, staffId: e.staffId, dayIndex: e.dayIndex, shift: e.shift },
        update: { shift: e.shift },
      });
    }
  }
  if (body.reoptimize) {
    const input = await loadSolverInput(roster.wardId, roster.startDate, roster.days);
    const result = solve(input);
    await prisma.assignment.deleteMany({ where: { rosterId: id } });
    await prisma.assignment.createMany({
      data: input.staff.flatMap((st, sIdx) =>
        result.grid[sIdx].map((shift, dayIndex) => ({
          rosterId: id,
          staffId: st.id,
          dayIndex,
          shift,
        }))
      ),
    });
    assignmentsChanged = true;
  }
  if (body.status === "PUBLISHED" || body.status === "DRAFT") {
    await prisma.roster.update({ where: { id }, data: { status: body.status } });
    // Publishing is what commits staff; unpublishing releases them.
    assignmentsChanged = true;
  }

  // Keep the cross-ward commitment record in step.
  let clashesWithOtherWards = 0;
  if (assignmentsChanged) {
    ({ skipped: clashesWithOtherWards } = await syncRosterCommitments(id));
  }

  const payload = await buildRosterPayload(id);
  if (!payload) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...payload, clashesWithOtherWards });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { id } = await params;
  const { count } = await prisma.roster.deleteMany({
    where: { id, ward: { hospitalId: guard.user.hospitalId } },
  });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
