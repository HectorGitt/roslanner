import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";

/** Resolve a `groupId` query/body value, checking it belongs to this hospital. */
async function resolveGroup(
  raw: unknown,
  hospitalId: string,
): Promise<{ groupId: string | null } | { error: string }> {
  if (raw === undefined || raw === null || raw === "") return { groupId: null };
  if (typeof raw !== "string") return { error: "Invalid group" };
  const group = await prisma.staffGroup.findFirst({ where: { id: raw, hospitalId } });
  if (!group) return { error: "Invalid group" };
  return { groupId: group.id };
}

export async function GET(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const wardId = req.nextUrl.searchParams.get("wardId");
  if (!wardId) return NextResponse.json({ error: "wardId required" }, { status: 400 });

  const scope = await resolveGroup(
    req.nextUrl.searchParams.get("groupId"),
    guard.user.hospitalId,
  );
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: 400 });

  const rules = await prisma.ruleSet.findFirst({
    where: {
      wardId,
      groupId: scope.groupId,
      ward: { hospitalId: guard.user.hospitalId },
    },
  });
  return NextResponse.json(rules);
}

export async function PUT(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { wardId, groupId, ...data } = await req.json();
  if (!wardId) return NextResponse.json({ error: "wardId required" }, { status: 400 });
  const ward = await prisma.ward.findFirst({
    where: { id: wardId, hospitalId: guard.user.hospitalId },
  });
  if (!ward) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const scope = await resolveGroup(groupId, guard.user.hospitalId);
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: 400 });

  const int = (v: unknown, min: number, max: number, fallback: number) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const fields = {
    maxConsecutiveDays: int(data.maxConsecutiveDays, 1, 31, 6),
    maxNightsPerWeek: int(data.maxNightsPerWeek, 0, 7, 3),
    minDaysOffPerWeek: int(data.minDaysOffPerWeek, 0, 7, 1),
    maxConsecutiveNights: int(data.maxConsecutiveNights, 1, 31, 4),
    minRestHours:
      data.minRestHours === null || data.minRestHours === ""
        ? null
        : int(data.minRestHours, 0, 48, 8),
    fairnessWindowDays: int(data.fairnessWindowDays, 0, 366, 0),
  };

  // Not an upsert: the unique key is (wardId, groupId), and a compound unique
  // containing a NULL never matches in Postgres, so the ward-level row would be
  // created again on every save.
  const existing = await prisma.ruleSet.findFirst({
    where: { wardId, groupId: scope.groupId },
  });
  const rules = existing
    ? await prisma.ruleSet.update({ where: { id: existing.id }, data: fields })
    : await prisma.ruleSet.create({
        data: { wardId, groupId: scope.groupId, ...fields },
      });
  return NextResponse.json(rules);
}
