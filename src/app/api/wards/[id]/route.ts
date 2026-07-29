import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { id } = await params;
  const ward = await prisma.ward.findFirst({
    where: { id, hospitalId: guard.user.hospitalId },
    include: {
      staff: {
        include: { role: true, tier: true, floatWards: { include: { ward: true } } },
        orderBy: { name: "asc" },
      },
      requirements: true,
      rules: true,
      shiftDefinitions: { orderBy: { sortOrder: "asc" } },
      // People based in other wards who can also be rostered here.
      floatStaff: {
        include: { staff: { include: { role: true, tier: true, ward: true } } },
      },
    },
  });
  if (!ward) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A ward can hold one rule set per staff group as well as its own, so `rules`
  // is now a list. Keep returning the ward's own as a single object — callers
  // wanting a group's fetch it from /api/rules?groupId=… — and expose the
  // group-scoped config separately so the UI can tell what overrides exist.
  const { rules, requirements, shiftDefinitions, ...rest } = ward;
  return NextResponse.json({
    ...rest,
    rules: rules.find((r) => r.groupId === null) ?? null,
    requirements: requirements.filter((r) => r.groupId === null),
    shiftDefinitions: shiftDefinitions.filter((s) => s.groupId === null),
    /** Which groups have config of their own on this ward. */
    groupOverrides: {
      rules: rules.filter((r) => r.groupId !== null).map((r) => r.groupId),
      requirements: [
        ...new Set(requirements.filter((r) => r.groupId !== null).map((r) => r.groupId)),
      ],
      shiftDefinitions: [
        ...new Set(shiftDefinitions.filter((s) => s.groupId !== null).map((s) => s.groupId)),
      ],
    },
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { id } = await params;
  const { name, category, cycleLengthDays } = await req.json();
  if (cycleLengthDays !== undefined) {
    const n = Number(cycleLengthDays);
    if (!Number.isInteger(n) || n < 1 || n > 62) {
      return NextResponse.json(
        { error: "Cycle length must be between 1 and 62 days" },
        { status: 400 },
      );
    }
  }
  const { count } = await prisma.ward.updateMany({
    where: { id, hospitalId: guard.user.hospitalId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(category !== undefined ? { category: String(category).trim() || "Standard" } : {}),
      ...(cycleLengthDays !== undefined ? { cycleLengthDays: Number(cycleLengthDays) } : {}),
    },
  });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { id } = await params;
  const { count } = await prisma.ward.deleteMany({
    where: { id, hospitalId: guard.user.hospitalId },
  });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
