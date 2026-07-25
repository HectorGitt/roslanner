import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";

export async function GET() {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const wards = await prisma.ward.findMany({
    where: { hospitalId: guard.user.hospitalId },
    include: { _count: { select: { staff: true, rosters: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(wards);
}

export async function POST(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  try {
    const ward = await prisma.ward.create({
      data: {
        name: name.trim(),
        hospitalId: guard.user.hospitalId,
        rules: { create: {} },
      },
    });
    return NextResponse.json(ward, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A ward with that name exists" }, { status: 409 });
  }
}
