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
      staff: { include: { role: true }, orderBy: { name: "asc" } },
      requirements: true,
      rules: true,
    },
  });
  if (!ward) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(ward);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { id } = await params;
  const { name } = await req.json();
  const { count } = await prisma.ward.updateMany({
    where: { id, hospitalId: guard.user.hospitalId },
    data: { name },
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
