import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findPreset, presetShiftRows } from "@/lib/roster/shift-presets";
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

  const { name, preset: presetKey } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  // A ward with no shifts can't be rostered at all, so start it from a preset
  // shift model. Every part of it stays editable afterwards.
  const preset = findPreset(presetKey);
  try {
    const ward = await prisma.ward.create({
      data: {
        name: name.trim(),
        hospitalId: guard.user.hospitalId,
        category: preset.category,
        cycleLengthDays: preset.cycleLengthDays,
        rules: { create: {} },
      },
    });
    await prisma.shiftDefinition.createMany({ data: presetShiftRows(preset, ward.id) });
    return NextResponse.json(ward, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A ward with that name exists" }, { status: 409 });
  }
}
