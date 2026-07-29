import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";

export async function GET() {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const groups = await prisma.staffGroup.findMany({
    where: { hospitalId: guard.user.hospitalId },
    include: {
      roles: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      _count: { select: { rosters: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { name, sortOrder } = await req.json();
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  try {
    const group = await prisma.staffGroup.create({
      data: {
        hospitalId: guard.user.hospitalId,
        name: name.trim().slice(0, 80),
        sortOrder: Math.floor(Number(sortOrder)) || 0,
      },
    });
    return NextResponse.json(group, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A group with that name exists" }, { status: 409 });
  }
}
