import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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
    include: { ward: true, _count: { select: { assignments: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(rosters);
}

/** Generate a roster: { wardId, startDate, days } */
export async function POST(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { wardId, startDate, days } = await req.json();
  if (!wardId || !startDate) {
    return NextResponse.json({ error: "wardId and startDate are required" }, { status: 400 });
  }

  const ward = await prisma.ward.findFirst({
    where: { id: wardId, hospitalId: guard.user.hospitalId },
  });
  if (!ward) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Default to the ward's own cycle length (7-day weekly, 30-day monthly stretch…).
  const nDays = days === undefined || days === null ? ward.cycleLengthDays : Number(days);
  if (!Number.isInteger(nDays) || nDays < 1 || nDays > 62) {
    return NextResponse.json({ error: "days must be between 1 and 62" }, { status: 400 });
  }

  const start = new Date(startDate + "T00:00:00");
  const input = await loadSolverInput(wardId, start, nDays);

  if (input.shiftDefs.length === 0) {
    return NextResponse.json(
      { error: "This ward has no shifts defined — set them up first" },
      { status: 400 },
    );
  }
  if (input.staff.length === 0) {
    return NextResponse.json(
      { error: "This ward has no active staff — add staff first" },
      { status: 400 },
    );
  }
  if (input.coverage.length === 0) {
    return NextResponse.json(
      { error: "This ward has no coverage requirements — set them first" },
      { status: 400 },
    );
  }

  const result = solve(input);

  const roster = await prisma.roster.create({
    data: {
      wardId,
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
