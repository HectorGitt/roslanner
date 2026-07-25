import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const wardId = req.nextUrl.searchParams.get("wardId") ?? undefined;
  const staff = await prisma.staff.findMany({
    where: { ward: { hospitalId: guard.user.hospitalId, ...(wardId ? { id: wardId } : {}) } },
    include: { role: true, ward: true },
    orderBy: [{ role: { name: "asc" } }, { name: "asc" }],
  });
  return NextResponse.json(staff);
}

export async function POST(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { name, roleId, wardId, tierId, fte, canBeLead } = await req.json();
  if (!name?.trim() || !roleId || !wardId) {
    return NextResponse.json(
      { error: "name, roleId and wardId are required" },
      { status: 400 },
    );
  }

  // Ward, role and (if given) tier must all belong to this hospital
  const [ward, role, tier] = await Promise.all([
    prisma.ward.findFirst({ where: { id: wardId, hospitalId: guard.user.hospitalId } }),
    prisma.role.findFirst({ where: { id: roleId, hospitalId: guard.user.hospitalId } }),
    tierId
      ? prisma.staffTier.findFirst({ where: { id: tierId, hospitalId: guard.user.hospitalId } })
      : Promise.resolve(null),
  ]);
  if (!ward || !role) {
    return NextResponse.json({ error: "Invalid ward or role" }, { status: 400 });
  }
  if (tierId && !tier) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const staff = await prisma.staff.create({
    data: {
      name: name.trim(),
      roleId,
      wardId,
      tierId: tierId || null,
      fte: fte === undefined ? undefined : Number(fte),
      canBeLead: canBeLead === undefined ? undefined : Boolean(canBeLead),
    },
    include: { role: true, tier: true },
  });
  return NextResponse.json(staff, { status: 201 });
}
