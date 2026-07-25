import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

async function findOwnStaff(id: string, hospitalId: string) {
  return prisma.staff.findFirst({ where: { id, ward: { hospitalId } } });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { id } = await params;
  if (!(await findOwnStaff(id, guard.user.hospitalId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { name, roleId, active } = await req.json();
  if (roleId !== undefined) {
    const role = await prisma.role.findFirst({
      where: { id: roleId, hospitalId: guard.user.hospitalId },
    });
    if (!role) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  const staff = await prisma.staff.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(roleId !== undefined ? { roleId } : {}),
      ...(active !== undefined ? { active } : {}),
    },
    include: { role: true },
  });
  return NextResponse.json(staff);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { id } = await params;
  if (!(await findOwnStaff(id, guard.user.hospitalId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.staff.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
