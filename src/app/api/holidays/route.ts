import { NextRequest, NextResponse } from "next/server";
import { parseISODate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";

export async function GET() {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const holidays = await prisma.publicHoliday.findMany({
    where: { hospitalId: guard.user.hospitalId },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(holidays);
}

/** { date, name, groupKey? } — groupKey defaults to a slug of the name. */
export async function POST(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { date, name, groupKey } = await req.json();
  if (!date || !name?.trim()) {
    return NextResponse.json({ error: "date and name are required" }, { status: 400 });
  }

  // Recurring holidays share a group key so "who worked it last year" can be
  // answered without matching on the date, which moves year to year.
  const key =
    (groupKey?.trim() || name.trim())
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "HOLIDAY";

  try {
    const holiday = await prisma.publicHoliday.create({
      data: {
        hospitalId: guard.user.hospitalId,
        date: parseISODate(date),
        name: name.trim(),
        groupKey: key,
      },
    });
    return NextResponse.json(holiday, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "That date is already a public holiday" },
      { status: 409 },
    );
  }
}
