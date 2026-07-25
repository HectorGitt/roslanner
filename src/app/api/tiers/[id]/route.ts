import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { id } = await params;
  const { name, rank, countsTowardClinicalCoverage, maxConsecutiveNights } = await req.json();
  const { count } = await prisma.staffTier.updateMany({
    where: { id, hospitalId: guard.user.hospitalId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(rank !== undefined ? { rank: Number(rank) } : {}),
      ...(countsTowardClinicalCoverage !== undefined
        ? { countsTowardClinicalCoverage: Boolean(countsTowardClinicalCoverage) }
        : {}),
      ...(maxConsecutiveNights !== undefined
        ? { maxConsecutiveNights: maxConsecutiveNights === null ? null : Number(maxConsecutiveNights) }
        : {}),
    },
  });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const tier = await prisma.staffTier.findUnique({ where: { id } });
  return NextResponse.json(tier);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { id } = await params;
  const { count } = await prisma.staffTier.deleteMany({
    where: { id, hospitalId: guard.user.hospitalId },
  });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
