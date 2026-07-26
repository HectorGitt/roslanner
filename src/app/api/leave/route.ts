import { NextRequest, NextResponse } from "next/server";
import { parseISODate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const wardId = req.nextUrl.searchParams.get("wardId") ?? undefined;
  const leave = await prisma.leaveRequest.findMany({
    where: {
      staff: {
        ward: { hospitalId: guard.user.hospitalId, ...(wardId ? { id: wardId } : {}) },
      },
    },
    include: { staff: { include: { role: true } } },
    orderBy: { startDate: "asc" },
  });
  return NextResponse.json(leave);
}

export async function POST(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { staffId, startDate, endDate, type, note } = await req.json();
  if (!staffId || !startDate || !endDate) {
    return NextResponse.json(
      { error: "staffId, startDate and endDate are required" },
      { status: 400 },
    );
  }
  if (new Date(endDate) < new Date(startDate)) {
    return NextResponse.json({ error: "endDate is before startDate" }, { status: 400 });
  }

  const staff = await prisma.staff.findFirst({
    where: { id: staffId, ward: { hospitalId: guard.user.hospitalId } },
  });
  if (!staff) return NextResponse.json({ error: "Invalid staff" }, { status: 400 });

  const leave = await prisma.leaveRequest.create({
    data: {
      staffId,
      startDate: parseISODate(startDate),
      endDate: parseISODate(endDate),
      type: type === "DAY_OFF_REQUEST" ? "DAY_OFF_REQUEST" : "LEAVE",
      note: note || null,
    },
    include: { staff: { include: { role: true } } },
  });
  return NextResponse.json(leave, { status: 201 });
}
