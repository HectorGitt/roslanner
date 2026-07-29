import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";
import { resolveGroupScope, scopedRows } from "@/lib/group-scope";

export async function GET(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const wardId = req.nextUrl.searchParams.get("wardId");
  if (!wardId) return NextResponse.json({ error: "wardId required" }, { status: 400 });
  const scope = await resolveGroupScope(
    req.nextUrl.searchParams.get("groupId"),
    guard.user.hospitalId,
  );
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: 400 });

  const items = await prisma.coverageRequirement.findMany({
    where: { wardId, groupId: scope.groupId, ward: { hospitalId: guard.user.hospitalId } },
  });
  return NextResponse.json(items);
}

interface CoverageInput {
  shift: string;
  roleId?: string | null;
  tierId?: string | null;
  required: number;
  /** 0 = Sunday … 6 = Saturday. Omitted or empty = every day. */
  daysOfWeek?: number[];
  /** SAME (default) | EXCLUDE | ONLY — how public holidays are treated. */
  holidayRule?: string;
}

const HOLIDAY_RULES = new Set(["SAME", "EXCLUDE", "ONLY"]);

/**
 * Replace a ward's coverage requirements:
 * { wardId, items: [{ shift, roleId?, tierId?, required }] }
 *
 * A row may be scoped by role, by tier, by both, or by neither (a plain
 * headcount floor for the shift).
 */
export async function PUT(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { wardId, groupId, items } = await req.json();
  if (!wardId || !Array.isArray(items)) {
    return NextResponse.json({ error: "wardId and items required" }, { status: 400 });
  }
  const ward = await prisma.ward.findFirst({
    where: { id: wardId, hospitalId: guard.user.hospitalId },
    include: { shiftDefinitions: true },
  });
  if (!ward) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const scope = await resolveGroupScope(groupId, guard.user.hospitalId);
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: 400 });

  const [roles, tiers] = await Promise.all([
    prisma.role.findMany({
      where: { hospitalId: guard.user.hospitalId },
      select: { id: true },
    }),
    prisma.staffTier.findMany({
      where: { hospitalId: guard.user.hospitalId },
      select: { id: true },
    }),
  ]);
  // The shifts this scope runs, under the same override-or-inherit rule as the
  // solver — a group's coverage can only name shifts that group works.
  const validShifts = new Set(
    scopedRows(ward.shiftDefinitions, scope.groupId).map((s) => s.code),
  );
  const validRoles = new Set(roles.map((r) => r.id));
  const validTiers = new Set(tiers.map((t) => t.id));

  const data: {
    wardId: string;
    groupId: string | null;
    shift: string;
    roleId: string | null;
    tierId: string | null;
    required: number;
    daysOfWeek: number[];
    holidayRule: string;
  }[] = [];
  for (const raw of items as CoverageInput[]) {
    const required = Number(raw.required) || 0;
    if (required <= 0) continue;
    if (!validShifts.has(raw.shift)) {
      return NextResponse.json(
        { error: `"${raw.shift}" isn't a shift in this ward` },
        { status: 400 },
      );
    }
    if (raw.roleId && !validRoles.has(raw.roleId)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (raw.tierId && !validTiers.has(raw.tierId)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }
    const holidayRule = raw.holidayRule ?? "SAME";
    if (!HOLIDAY_RULES.has(holidayRule)) {
      return NextResponse.json({ error: "Invalid holiday rule" }, { status: 400 });
    }
    // Seven entries means "every day", which is what an empty list already says.
    const days = [...new Set((raw.daysOfWeek ?? []).map(Number))]
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
      .sort();
    data.push({
      wardId,
      groupId: scope.groupId,
      shift: raw.shift,
      roleId: raw.roleId || null,
      tierId: raw.tierId || null,
      required,
      daysOfWeek: days.length === 7 ? [] : days,
      holidayRule,
    });
  }

  const seen = new Set<string>();
  for (const d of data) {
    const key = [d.shift, d.roleId ?? "", d.tierId ?? "", d.holidayRule, d.daysOfWeek.join(".")].join("|");
    if (seen.has(key)) {
      return NextResponse.json(
        { error: "Two requirements have the same shift, scope and days" },
        { status: 400 },
      );
    }
    seen.add(key);
  }

  await prisma.$transaction([
    prisma.coverageRequirement.deleteMany({ where: { wardId, groupId: scope.groupId } }),
    prisma.coverageRequirement.createMany({ data }),
  ]);
  const saved = await prisma.coverageRequirement.findMany({
    where: { wardId, groupId: scope.groupId },
  });
  return NextResponse.json(saved);
}
