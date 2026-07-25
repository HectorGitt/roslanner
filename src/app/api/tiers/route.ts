import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";

export async function GET() {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const tiers = await prisma.staffTier.findMany({
    where: { hospitalId: guard.user.hospitalId },
    include: { _count: { select: { staff: true } } },
    orderBy: { rank: "asc" },
  });
  return NextResponse.json(tiers);
}

export async function POST(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { name, rank, countsTowardClinicalCoverage, maxConsecutiveNights } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  try {
    const tier = await prisma.staffTier.create({
      data: {
        name: name.trim(),
        hospitalId: guard.user.hospitalId,
        rank: Number(rank) || 0,
        countsTowardClinicalCoverage: countsTowardClinicalCoverage !== false,
        maxConsecutiveNights:
          maxConsecutiveNights === null || maxConsecutiveNights === undefined || maxConsecutiveNights === ""
            ? null
            : Number(maxConsecutiveNights),
      },
    });
    return NextResponse.json(tier, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A tier with that name exists" }, { status: 409 });
  }
}
