import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const wardId = req.nextUrl.searchParams.get("wardId");
  if (!wardId) return NextResponse.json({ error: "wardId required" }, { status: 400 });

  const ward = await prisma.ward.findFirst({
    where: { id: wardId, hospitalId: guard.user.hospitalId },
    select: { id: true },
  });
  if (!ward) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items = await prisma.tierShiftEligibility.findMany({
    where: { shiftDef: { wardId } },
  });
  return NextResponse.json(items);
}

/** Bulk upsert eligibility for a ward: { wardId, items: [{tierId, shiftDefId, eligible, weekendEligible}] } */
export async function PUT(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { wardId, items } = await req.json();
  if (!wardId || !Array.isArray(items)) {
    return NextResponse.json({ error: "wardId and items required" }, { status: 400 });
  }
  const ward = await prisma.ward.findFirst({
    where: { id: wardId, hospitalId: guard.user.hospitalId },
    include: { shiftDefinitions: true },
  });
  if (!ward) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const validShiftDefIds = new Set(ward.shiftDefinitions.map((s) => s.id));
  const validTierIds = new Set(
    (
      await prisma.staffTier.findMany({
        where: { hospitalId: guard.user.hospitalId },
        select: { id: true },
      })
    ).map((t) => t.id),
  );

  const safeItems = items.filter(
    (i: { tierId: string; shiftDefId: string }) =>
      validShiftDefIds.has(i.shiftDefId) && validTierIds.has(i.tierId),
  );

  await prisma.$transaction([
    prisma.tierShiftEligibility.deleteMany({
      where: { shiftDefId: { in: [...validShiftDefIds] } },
    }),
    prisma.tierShiftEligibility.createMany({
      data: safeItems.map(
        (i: { tierId: string; shiftDefId: string; eligible: boolean; weekendEligible: boolean }) => ({
          tierId: i.tierId,
          shiftDefId: i.shiftDefId,
          eligible: i.eligible,
          weekendEligible: i.weekendEligible,
        }),
      ),
    }),
  ]);

  const saved = await prisma.tierShiftEligibility.findMany({
    where: { shiftDef: { wardId } },
  });
  return NextResponse.json(saved);
}
