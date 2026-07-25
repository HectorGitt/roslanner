import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";

export async function GET() {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const roles = await prisma.role.findMany({
    where: { hospitalId: guard.user.hospitalId },
    include: { _count: { select: { staff: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(roles);
}

export async function POST(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  try {
    const role = await prisma.role.create({
      data: { name: name.trim(), hospitalId: guard.user.hospitalId },
    });
    return NextResponse.json(role, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A role with that name exists" }, { status: 409 });
  }
}
