import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";

const DETAIL = {
  roster: { include: { ward: { select: { id: true, name: true } } } },
  requestingAssignment: { include: { staff: { select: { id: true, name: true } } } },
  acceptingAssignment: { include: { staff: { select: { id: true, name: true } } } },
} as const;

export async function GET(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const swaps = await prisma.swapRequest.findMany({
    where: {
      roster: { ward: { hospitalId: guard.user.hospitalId } },
      ...(status ? { status: status as never } : {}),
    },
    include: DETAIL,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(swaps);
}

/**
 * Offer a shift for exchange: { rosterId, offeredAssignmentId, note? }.
 * Nothing is checked yet — a request only becomes a proposal once someone
 * offers a shift back, which is when the rules are run.
 */
export async function POST(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { rosterId, offeredAssignmentId, note } = await req.json();
  if (!rosterId || !offeredAssignmentId) {
    return NextResponse.json(
      { error: "rosterId and offeredAssignmentId are required" },
      { status: 400 },
    );
  }

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: offeredAssignmentId,
      rosterId,
      roster: { ward: { hospitalId: guard.user.hospitalId } },
    },
  });
  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const open = await prisma.swapRequest.findFirst({
    where: {
      requestingAssignmentId: offeredAssignmentId,
      status: { in: ["PENDING_ACCEPT", "PENDING_APPROVAL"] },
    },
  });
  if (open) {
    return NextResponse.json(
      { error: "That shift already has a swap in progress" },
      { status: 409 },
    );
  }

  const swap = await prisma.swapRequest.create({
    data: {
      rosterId,
      requestingAssignmentId: offeredAssignmentId,
      note: note?.trim() || null,
    },
    include: DETAIL,
  });
  return NextResponse.json(swap, { status: 201 });
}
