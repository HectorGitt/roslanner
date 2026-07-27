import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveChargeLeads } from "@/lib/roster/charge-leads";
import { syncRosterCommitments } from "@/lib/roster/commitments";
import { assignChargeLeads } from "@/lib/roster/solve";
import { loadSolverInput } from "@/lib/roster/load";
import { applySwap, checkSwap } from "@/lib/roster/swaps";
import { CellValue, DAY_OFF, Grid } from "@/lib/roster/types";
import { requireHospitalUser } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

const DETAIL = {
  roster: { include: { ward: { select: { id: true, name: true } } } },
  requestingAssignment: { include: { staff: { select: { id: true, name: true } } } },
  acceptingAssignment: { include: { staff: { select: { id: true, name: true } } } },
} as const;

/**
 * Move a swap along: { action: "accept" | "approve" | "decline" | "cancel" }.
 *
 *   accept  — someone offers a shift back; the rules are checked here and the
 *             swap either waits for approval or is rejected with the reason.
 *   approve — the head of unit signs it off; rules are re-checked because the
 *             roster may have moved on since, and only then is it applied.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { id } = await params;
  const swap = await prisma.swapRequest.findFirst({
    where: { id, roster: { ward: { hospitalId: guard.user.hospitalId } } },
  });
  if (!swap) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { action, acceptingAssignmentId } = await req.json();

  if (action === "cancel") {
    if (swap.status === "APPROVED") {
      return NextResponse.json(
        { error: "That swap has already been applied" },
        { status: 409 },
      );
    }
    const updated = await prisma.swapRequest.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: DETAIL,
    });
    return NextResponse.json(updated);
  }

  if (action === "decline") {
    const updated = await prisma.swapRequest.update({
      where: { id },
      data: {
        status: "DECLINED",
        reviewedByUserId: guard.user.id,
        reviewedAt: new Date(),
      },
      include: DETAIL,
    });
    return NextResponse.json(updated);
  }

  if (action === "accept") {
    if (swap.status !== "PENDING_ACCEPT") {
      return NextResponse.json(
        { error: "That swap is no longer waiting for an offer" },
        { status: 409 },
      );
    }
    if (!acceptingAssignmentId) {
      return NextResponse.json(
        { error: "acceptingAssignmentId is required" },
        { status: 400 },
      );
    }
    const other = await prisma.assignment.findFirst({
      where: { id: acceptingAssignmentId, rosterId: swap.rosterId },
    });
    if (!other) {
      return NextResponse.json(
        { error: "That shift isn't part of this roster" },
        { status: 400 },
      );
    }
    if (other.id === swap.requestingAssignmentId) {
      return NextResponse.json({ error: "A shift can't swap with itself" }, { status: 400 });
    }

    const check = await checkSwap(swap.rosterId, swap.requestingAssignmentId, other.id);
    if (!check) return NextResponse.json({ error: "Could not evaluate" }, { status: 400 });

    const updated = await prisma.swapRequest.update({
      where: { id },
      data: {
        acceptingAssignmentId: other.id,
        status: check.allowed ? "PENDING_APPROVAL" : "HARD_RULE_REJECTED",
        proposedEvaluation: {
          hardBefore: check.before.hardCount,
          hardAfter: check.after.hardCount,
          blockedBy: check.newViolations.map((v) => v.message),
        },
      },
      include: DETAIL,
    });
    return NextResponse.json({
      ...updated,
      allowed: check.allowed,
      blockedBy: check.newViolations.map((v) => v.message),
    });
  }

  if (action === "approve") {
    if (swap.status !== "PENDING_APPROVAL" || !swap.acceptingAssignmentId) {
      return NextResponse.json(
        { error: "That swap isn't waiting for approval" },
        { status: 409 },
      );
    }
    // The roster may have been edited since it was accepted, so check again
    // rather than trusting the snapshot.
    const check = await checkSwap(
      swap.rosterId,
      swap.requestingAssignmentId,
      swap.acceptingAssignmentId,
    );
    if (!check) return NextResponse.json({ error: "Could not evaluate" }, { status: 400 });
    if (!check.allowed) {
      const rejected = await prisma.swapRequest.update({
        where: { id },
        data: {
          status: "HARD_RULE_REJECTED",
          proposedEvaluation: {
            hardBefore: check.before.hardCount,
            hardAfter: check.after.hardCount,
            blockedBy: check.newViolations.map((v) => v.message),
          },
          reviewedByUserId: guard.user.id,
          reviewedAt: new Date(),
        },
        include: DETAIL,
      });
      return NextResponse.json(
        {
          ...rejected,
          error: "The roster has changed and this swap would now break a rule",
          blockedBy: check.newViolations.map((v) => v.message),
        },
        { status: 409 },
      );
    }

    await applySwap(swap.requestingAssignmentId, swap.acceptingAssignmentId);

    // The grid changed, so who is committed where and who leads each shift both
    // need recomputing.
    const roster = await prisma.roster.findUnique({
      where: { id: swap.rosterId },
      include: { assignments: true },
    });
    if (roster) {
      const input = await loadSolverInput(roster.wardId, roster.startDate, roster.days);
      const rowOf = new Map(input.staff.map((s, i) => [s.id, i]));
      const grid: Grid = input.staff.map(() =>
        Array<CellValue>(roster.days).fill(DAY_OFF),
      );
      for (const a of roster.assignments) {
        const row = rowOf.get(a.staffId);
        if (row !== undefined && a.dayIndex < roster.days) grid[row][a.dayIndex] = a.shift;
      }
      await saveChargeLeads(roster.id, assignChargeLeads(input, grid));
      await syncRosterCommitments(roster.id);
    }

    const updated = await prisma.swapRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedByUserId: guard.user.id,
        reviewedAt: new Date(),
      },
      include: DETAIL,
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
