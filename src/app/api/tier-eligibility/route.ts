import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";

/**
 * Tier shift eligibility is hospital-wide, keyed by shift code — one rule
 * applies in every ward that uses that shift. Returns the eligibility rows
 * plus the hospital's shift-code vocabulary (the distinct codes across all
 * its wards) so the UI can render the tier x shift matrix.
 */
export async function GET() {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const [items, shiftDefs] = await Promise.all([
    prisma.tierShiftEligibility.findMany({
      where: { tier: { hospitalId: guard.user.hospitalId } },
    }),
    prisma.shiftDefinition.findMany({
      where: { ward: { hospitalId: guard.user.hospitalId } },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    }),
  ]);

  // Collapse per-ward definitions into the shared code vocabulary.
  const shifts: { code: string; label: string; isNightLike: boolean }[] = [];
  for (const sd of shiftDefs) {
    if (!shifts.some((s) => s.code === sd.code)) {
      shifts.push({ code: sd.code, label: sd.label, isNightLike: sd.isNightLike });
    }
  }

  return NextResponse.json({ items, shifts });
}

/** Bulk replace: { items: [{tierId, shiftCode, eligible, weekendEligible}] } */
export async function PUT(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { items } = await req.json();
  if (!Array.isArray(items)) {
    return NextResponse.json({ error: "items required" }, { status: 400 });
  }

  const [tiers, shiftDefs] = await Promise.all([
    prisma.staffTier.findMany({
      where: { hospitalId: guard.user.hospitalId },
      select: { id: true },
    }),
    prisma.shiftDefinition.findMany({
      where: { ward: { hospitalId: guard.user.hospitalId } },
      select: { code: true },
    }),
  ]);
  const validTierIds = new Set(tiers.map((t) => t.id));
  const validCodes = new Set(shiftDefs.map((s) => s.code));

  const safe = items.filter(
    (i: { tierId: string; shiftCode: string }) =>
      validTierIds.has(i.tierId) && validCodes.has(i.shiftCode),
  );

  await prisma.$transaction([
    prisma.tierShiftEligibility.deleteMany({
      where: { tier: { hospitalId: guard.user.hospitalId } },
    }),
    prisma.tierShiftEligibility.createMany({
      data: safe.map(
        (i: {
          tierId: string;
          shiftCode: string;
          eligible: boolean;
          weekendEligible: boolean;
          holidayEligible?: boolean;
        }) => ({
          tierId: i.tierId,
          shiftCode: i.shiftCode,
          eligible: i.eligible,
          weekendEligible: i.weekendEligible,
          // Absent means unrestricted, matching how a missing row behaves.
          holidayEligible: i.holidayEligible ?? true,
        }),
      ),
    }),
  ]);

  const saved = await prisma.tierShiftEligibility.findMany({
    where: { tier: { hospitalId: guard.user.hospitalId } },
  });
  return NextResponse.json(saved);
}
