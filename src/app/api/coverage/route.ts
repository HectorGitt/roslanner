import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const wardId = req.nextUrl.searchParams.get("wardId");
  if (!wardId) return NextResponse.json({ error: "wardId required" }, { status: 400 });
  const items = await prisma.coverageRequirement.findMany({
    where: { wardId, ward: { hospitalId: guard.user.hospitalId } },
  });
  return NextResponse.json(items);
}

/** Bulk upsert coverage for a ward: { wardId, items: [{shift, roleId, required}] } */
export async function PUT(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { wardId, items } = await req.json();
  if (!wardId || !Array.isArray(items)) {
    return NextResponse.json({ error: "wardId and items required" }, { status: 400 });
  }
  const ward = await prisma.ward.findFirst({
    where: { id: wardId, hospitalId: guard.user.hospitalId },
  });
  if (!ward) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.coverageRequirement.deleteMany({ where: { wardId } }),
    prisma.coverageRequirement.createMany({
      data: items
        .filter((i: { required: number }) => i.required > 0)
        .map((i: { shift: string; roleId: string; required: number }) => ({
          wardId,
          shift: i.shift,
          roleId: i.roleId,
          required: i.required,
        })),
    }),
  ]);
  const saved = await prisma.coverageRequirement.findMany({ where: { wardId } });
  return NextResponse.json(saved);
}
