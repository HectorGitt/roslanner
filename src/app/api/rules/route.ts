import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const wardId = req.nextUrl.searchParams.get("wardId");
  if (!wardId) return NextResponse.json({ error: "wardId required" }, { status: 400 });
  const rules = await prisma.ruleSet.findFirst({
    where: { wardId, ward: { hospitalId: guard.user.hospitalId } },
  });
  return NextResponse.json(rules);
}

export async function PUT(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { wardId, ...data } = await req.json();
  if (!wardId) return NextResponse.json({ error: "wardId required" }, { status: 400 });
  const ward = await prisma.ward.findFirst({
    where: { id: wardId, hospitalId: guard.user.hospitalId },
  });
  if (!ward) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fields = {
    maxConsecutiveDays: Number(data.maxConsecutiveDays),
    maxNightsPerWeek: Number(data.maxNightsPerWeek),
    minDaysOffPerWeek: Number(data.minDaysOffPerWeek),
    maxConsecutiveNights: Number(data.maxConsecutiveNights),
    noMorningAfterNight: Boolean(data.noMorningAfterNight),
  };
  const rules = await prisma.ruleSet.upsert({
    where: { wardId },
    create: { wardId, ...fields },
    update: fields,
  });
  return NextResponse.json(rules);
}
