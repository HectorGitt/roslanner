import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";

export async function GET() {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const roles = await prisma.role.findMany({
    where: { hospitalId: guard.user.hospitalId },
    include: { group: true, _count: { select: { staff: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(roles);
}

export async function POST(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { name, groupId } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  try {
    if (groupId) {
      const group = await prisma.staffGroup.findFirst({
        where: { id: groupId, hospitalId: guard.user.hospitalId },
      });
      if (!group) return NextResponse.json({ error: "Invalid group" }, { status: 400 });
    }
    const role = await prisma.role.create({
      data: {
        name: name.trim(),
        hospitalId: guard.user.hospitalId,
        groupId: groupId || null,
      },
      include: { group: true },
    });
    return NextResponse.json(role, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A role with that name exists" }, { status: 409 });
  }
}
