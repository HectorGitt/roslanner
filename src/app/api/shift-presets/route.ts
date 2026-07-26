import { NextResponse } from "next/server";
import { SHIFT_PRESETS } from "@/lib/roster/shift-presets";
import { requireHospitalUser } from "@/lib/session";

/** Starting shift models offered when creating a ward. */
export async function GET() {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  return NextResponse.json(
    SHIFT_PRESETS.map((p) => ({
      key: p.key,
      category: p.category,
      description: p.description,
      cycleLengthDays: p.cycleLengthDays,
      shifts: p.shifts.map((s) => ({ code: s.code, label: s.label })),
    })),
  );
}
