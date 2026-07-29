import { NextRequest, NextResponse } from "next/server";
import { parseISODate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { saveChargeLeads } from "@/lib/roster/charge-leads";
import { syncRosterCommitments } from "@/lib/roster/commitments";
import { loadSolverInput } from "@/lib/roster/load";
import { solve } from "@/lib/roster/solve";
import { requireHospitalUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const wardId = req.nextUrl.searchParams.get("wardId") ?? undefined;
  const rosters = await prisma.roster.findMany({
    where: {
      ward: { hospitalId: guard.user.hospitalId, ...(wardId ? { id: wardId } : {}) },
    },
    include: { ward: true, group: true, _count: { select: { assignments: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(rosters);
}

/** Generate a roster: { wardId, startDate, days } */
export async function POST(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { wardId, startDate, days, groupId } = await req.json();
  if (!wardId || !startDate) {
    return NextResponse.json({ error: "wardId and startDate are required" }, { status: 400 });
  }

  const ward = await prisma.ward.findFirst({
    where: { id: wardId, hospitalId: guard.user.hospitalId },
  });
  if (!ward) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A roster either covers one body of staff under that group's rules, or the
  // whole ward under the ward's.
  let group: { id: string; name: string } | null = null;
  if (groupId) {
    group = await prisma.staffGroup.findFirst({
      where: { id: groupId, hospitalId: guard.user.hospitalId },
      select: { id: true, name: true },
    });
    if (!group) return NextResponse.json({ error: "Invalid group" }, { status: 400 });
  }

  // Default to the ward's own cycle length (7-day weekly, 30-day monthly stretch…).
  const nDays = days === undefined || days === null ? ward.cycleLengthDays : Number(days);
  if (!Number.isInteger(nDays) || nDays < 1 || nDays > 62) {
    return NextResponse.json({ error: "days must be between 1 and 62" }, { status: 400 });
  }

  const start = parseISODate(startDate);
  const input = await loadSolverInput(wardId, start, nDays, group?.id ?? null);

  // A ward whose config has all moved into groups has nothing left at ward level,
  // so a whole-ward roster legitimately can't be built. Say that, rather than
  // implying the ward was never set up.
  const groupsWithConfig = group
    ? []
    : await prisma.staffGroup.findMany({
        where: {
          hospitalId: guard.user.hospitalId,
          OR: [
            { requirements: { some: { wardId } } },
            { shiftDefinitions: { some: { wardId } } },
          ],
        },
        select: { name: true },
        orderBy: { sortOrder: "asc" },
      });
  const perGroupHint =
    groupsWithConfig.length > 0
      ? ` This ward is set up per group (${groupsWithConfig
          .map((g) => g.name)
          .join(", ")}) — choose one of those instead of the whole ward.`
      : "";

  if (input.shiftDefs.length === 0) {
    return NextResponse.json(
      {
        error: group
          ? `No shifts apply to ${group.name} on this ward — give the group its own shifts, or define the ward's`
          : `This ward has no shifts defined — set them up first.${perGroupHint}`,
      },
      { status: 400 },
    );
  }
  if (input.staff.length === 0) {
    return NextResponse.json(
      {
        error: group
          ? `No active ${group.name} staff on this ward — tag the roles that belong to ${group.name}, or add staff`
          : "This ward has no active staff — add staff first",
      },
      { status: 400 },
    );
  }
  if (input.coverage.length === 0) {
    return NextResponse.json(
      {
        error: group
          ? `No coverage requirements apply to ${group.name} on this ward — set them for the group, or leave the ward's in place`
          : `This ward has no coverage requirements — set them first.${perGroupHint}`,
      },
      { status: 400 },
    );
  }

  const result = solve(input);

  const roster = await prisma.roster.create({
    data: {
      wardId,
      groupId: group?.id ?? null,
      startDate: start,
      days: nDays,
      assignments: {
        create: input.staff.flatMap((st, sIdx) =>
          result.grid[sIdx].map((shift, dayIndex) => ({
            staffId: st.id,
            dayIndex,
            shift,
          })),
        ),
      },
    },
  });

  await saveChargeLeads(roster.id, result.chargeLeads);
  const { skipped } = await syncRosterCommitments(roster.id);

  return NextResponse.json(
    {
      rosterId: roster.id,
      evaluation: result.evaluation,
      elapsedMs: result.elapsedMs,
      clashesWithOtherWards: skipped,
    },
    { status: 201 },
  );
}
