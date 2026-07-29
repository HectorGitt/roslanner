import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

/** Rename a role, or move it into (or out of) a staff group. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { id } = await params;
  const own = await prisma.role.findFirst({
    where: { id, hospitalId: guard.user.hospitalId },
  });
  if (!own) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, groupId } = await req.json();

  // groupId: a string moves the role into that group, null takes it out of any
  // group, undefined leaves it alone.
  if (groupId) {
    const group = await prisma.staffGroup.findFirst({
      where: { id: groupId, hospitalId: guard.user.hospitalId },
    });
    if (!group) return NextResponse.json({ error: "Invalid group" }, { status: 400 });
  }

  try {
    const role = await prisma.role.update({
      where: { id },
      data: {
        ...(typeof name === "string" && name.trim()
          ? { name: name.trim().slice(0, 80) }
          : {}),
        ...(groupId !== undefined ? { groupId: groupId || null } : {}),
      },
      include: { group: true },
    });
    return NextResponse.json(role);
  } catch {
    return NextResponse.json({ error: "A role with that name exists" }, { status: 409 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { id } = await params;
  try {
    const { count } = await prisma.role.deleteMany({
      where: { id, hospitalId: guard.user.hospitalId },
    });
    if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Role is in use by staff and cannot be deleted" },
      { status: 409 },
    );
  }
}
