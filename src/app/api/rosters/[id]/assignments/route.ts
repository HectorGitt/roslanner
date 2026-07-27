import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

/**
 * The roster's assignments with their ids. The roster payload carries a grid,
 * which is what the planner sees, but a swap has to name the exact rows being
 * exchanged.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { id } = await params;
  const rows = await prisma.assignment.findMany({
    where: { rosterId: id, roster: { ward: { hospitalId: guard.user.hospitalId } } },
    select: { id: true, staffId: true, dayIndex: true, shift: true },
    orderBy: [{ dayIndex: "asc" }],
  });
  return NextResponse.json(rows);
}
