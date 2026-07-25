import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";

export async function GET() {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const pairings = await prisma.tierPairingRule.findMany({
    where: { dependentTier: { hospitalId: guard.user.hospitalId } },
    include: { dependentTier: true, requiredTier: true },
  });
  return NextResponse.json(pairings);
}

/** { dependentTierId, requiredTierId, minRequiredCount } — applies to every shift. */
export async function POST(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { dependentTierId, requiredTierId, minRequiredCount } = await req.json();
  if (!dependentTierId || !requiredTierId) {
    return NextResponse.json(
      { error: "dependentTierId and requiredTierId are required" },
      { status: 400 },
    );
  }
  if (dependentTierId === requiredTierId) {
    return NextResponse.json({ error: "A tier can't require itself" }, { status: 400 });
  }

  const [dependent, required] = await Promise.all([
    prisma.staffTier.findFirst({ where: { id: dependentTierId, hospitalId: guard.user.hospitalId } }),
    prisma.staffTier.findFirst({ where: { id: requiredTierId, hospitalId: guard.user.hospitalId } }),
  ]);
  if (!dependent || !required) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  try {
    const pairing = await prisma.tierPairingRule.create({
      data: {
        dependentTierId,
        requiredTierId,
        minRequiredCount: Number(minRequiredCount) || 1,
      },
      include: { dependentTier: true, requiredTier: true },
    });
    return NextResponse.json(pairing, { status: 201 });
  } catch {
    return NextResponse.json({ error: "That pairing rule already exists" }, { status: 409 });
  }
}
