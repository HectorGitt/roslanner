import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const wardId = req.nextUrl.searchParams.get("wardId");
  if (!wardId) return NextResponse.json({ error: "wardId required" }, { status: 400 });
  const items = await prisma.coverageRequirement.findMany({
    where: { wardId, ward: { hospitalId: guard.user.hospitalId } },
  });
  return NextResponse.json(items);
}

interface CoverageInput {
  shift: string;
  roleId?: string | null;
  tierId?: string | null;
  required: number;
}

/**
 * Replace a ward's coverage requirements:
 * { wardId, items: [{ shift, roleId?, tierId?, required }] }
 *
 * A row may be scoped by role, by tier, by both, or by neither (a plain
 * headcount floor for the shift).
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
    include: { shiftDefinitions: true },
  });
  if (!ward) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [roles, tiers] = await Promise.all([
    prisma.role.findMany({
      where: { hospitalId: guard.user.hospitalId },
      select: { id: true },
    }),
    prisma.staffTier.findMany({
      where: { hospitalId: guard.user.hospitalId },
      select: { id: true },
    }),
  ]);
  const validShifts = new Set(ward.shiftDefinitions.map((s) => s.code));
  const validRoles = new Set(roles.map((r) => r.id));
  const validTiers = new Set(tiers.map((t) => t.id));

  const data: {
    wardId: string;
    shift: string;
    roleId: string | null;
    tierId: string | null;
    required: number;
  }[] = [];
  for (const raw of items as CoverageInput[]) {
    const required = Number(raw.required) || 0;
    if (required <= 0) continue;
    if (!validShifts.has(raw.shift)) {
      return NextResponse.json(
        { error: `"${raw.shift}" isn't a shift in this ward` },
        { status: 400 },
      );
    }
    if (raw.roleId && !validRoles.has(raw.roleId)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (raw.tierId && !validTiers.has(raw.tierId)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }
    data.push({
      wardId,
      shift: raw.shift,
      roleId: raw.roleId || null,
      tierId: raw.tierId || null,
      required,
    });
  }

  await prisma.$transaction([
    prisma.coverageRequirement.deleteMany({ where: { wardId } }),
    prisma.coverageRequirement.createMany({ data }),
  ]);
  const saved = await prisma.coverageRequirement.findMany({ where: { wardId } });
  return NextResponse.json(saved);
}
