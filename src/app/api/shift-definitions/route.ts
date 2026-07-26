import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const wardId = req.nextUrl.searchParams.get("wardId");
  if (!wardId) return NextResponse.json({ error: "wardId required" }, { status: 400 });

  const items = await prisma.shiftDefinition.findMany({
    where: { wardId, ward: { hospitalId: guard.user.hospitalId } },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(items);
}

interface ShiftInput {
  code: string;
  label: string;
  startMinutes: number;
  endMinutes: number;
  isNightLike?: boolean;
  payrollTag?: string | null;
}

/**
 * Replace a ward's shift vocabulary: { wardId, items: [...] }.
 *
 * Existing rosters store shift *codes*, so removing a code that past rosters
 * used leaves those cells referencing an undefined shift. The response reports how
 * many stored assignments are affected so the UI can warn rather than silently
 * corrupting published rosters.
 */
export async function PUT(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { wardId, items } = await req.json();
  if (!wardId || !Array.isArray(items)) {
    return NextResponse.json({ error: "wardId and items required" }, { status: 400 });
  }
  const ward = await prisma.ward.findFirst({
    where: { id: wardId, hospitalId: guard.user.hospitalId },
  });
  if (!ward) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cleaned: ShiftInput[] = [];
  for (const raw of items as ShiftInput[]) {
    const code = String(raw.code ?? "").trim().toUpperCase().replace(/\s+/g, "_");
    const label = String(raw.label ?? "").trim();
    if (!code || !label) {
      return NextResponse.json(
        { error: "Every shift needs a code and a label" },
        { status: 400 },
      );
    }
    if (code === "DO") {
      return NextResponse.json(
        { error: '"DO" is reserved for days off — use another code' },
        { status: 400 },
      );
    }
    if (cleaned.some((c) => c.code === code)) {
      return NextResponse.json({ error: `Duplicate shift code "${code}"` }, { status: 400 });
    }
    const startMinutes = Number(raw.startMinutes);
    const endMinutes = Number(raw.endMinutes);
    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
      return NextResponse.json({ error: "Shift times are required" }, { status: 400 });
    }
    cleaned.push({
      code,
      label,
      startMinutes,
      endMinutes,
      isNightLike: Boolean(raw.isNightLike),
      payrollTag: raw.payrollTag?.trim() || null,
    });
  }
  if (cleaned.length === 0) {
    return NextResponse.json(
      { error: "A ward needs at least one shift" },
      { status: 400 },
    );
  }

  const keptCodes = new Set(cleaned.map((c) => c.code));
  const orphanedAssignments = await prisma.assignment.count({
    where: {
      roster: { wardId },
      shift: { notIn: [...keptCodes, "DO"] },
    },
  });

  await prisma.$transaction([
    prisma.shiftDefinition.deleteMany({ where: { wardId } }),
    prisma.shiftDefinition.createMany({
      data: cleaned.map((c, i) => ({
        wardId,
        code: c.code,
        label: c.label,
        startMinutes: c.startMinutes,
        endMinutes: c.endMinutes,
        // A shift whose end time is at or before its start wraps past midnight.
        crossesMidnight: c.endMinutes <= c.startMinutes,
        isNightLike: c.isNightLike ?? false,
        payrollTag: c.payrollTag ?? null,
        sortOrder: i,
      })),
    }),
    // Coverage rows for removed shifts would demand staff for a shift that no
    // longer exists, so drop them alongside.
    prisma.coverageRequirement.deleteMany({
      where: { wardId, shift: { notIn: [...keptCodes] } },
    }),
  ]);

  const saved = await prisma.shiftDefinition.findMany({
    where: { wardId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ items: saved, orphanedAssignments });
}
