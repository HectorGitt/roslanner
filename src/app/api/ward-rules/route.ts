import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";
import { resolveGroupScope } from "@/lib/group-scope";

/**
 * Rules that carry their own parameters, as opposed to the fixed numeric limits
 * on RuleSet. The set of types is fixed in code — evaluate() has a branch per
 * type — so only the thresholds and scope are configurable here.
 */
const RULE_TYPES = ["BLOCK_PATTERN_ON_OFF", "CHARGE_LEAD_REQUIRED", "MAX_HOURS_PER_WEEK"] as const;
type RuleTypeName = (typeof RULE_TYPES)[number];

/** Which numeric parameters each type expects, and what to use if absent. */
const PARAM_DEFAULTS: Record<RuleTypeName, Record<string, number>> = {
  BLOCK_PATTERN_ON_OFF: { blockDays: 7 },
  CHARGE_LEAD_REQUIRED: {},
  MAX_HOURS_PER_WEEK: { hours: 48 },
};

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

  const items = await prisma.wardRule.findMany({
    where: { wardId, groupId: scope.groupId, ward: { hospitalId: guard.user.hospitalId } },
    include: { tier: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ items, types: RULE_TYPES, paramDefaults: PARAM_DEFAULTS });
}

/** { wardId, type, params?, tierId?, shiftCode? } */
export async function POST(req: NextRequest) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { wardId, groupId, type, params, tierId, shiftCode } = await req.json();
  if (!wardId || !RULE_TYPES.includes(type)) {
    return NextResponse.json({ error: "wardId and a known rule type are required" }, { status: 400 });
  }
  const ward = await prisma.ward.findFirst({
    where: { id: wardId, hospitalId: guard.user.hospitalId },
    include: { shiftDefinitions: { select: { code: true } } },
  });
  if (!ward) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const scope = await resolveGroupScope(groupId, guard.user.hospitalId);
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: 400 });

  if (tierId) {
    const tier = await prisma.staffTier.findFirst({
      where: { id: tierId, hospitalId: guard.user.hospitalId },
    });
    if (!tier) return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }
  if (shiftCode && !ward.shiftDefinitions.some((s) => s.code === shiftCode)) {
    return NextResponse.json({ error: "That shift isn't in this ward" }, { status: 400 });
  }

  // Keep only the parameters this type understands, so a stray key can't sit in
  // the JSON looking meaningful.
  const expected = PARAM_DEFAULTS[type as RuleTypeName];
  const cleaned: Record<string, number> = {};
  for (const [key, fallback] of Object.entries(expected)) {
    const given = Number(params?.[key]);
    cleaned[key] = Number.isFinite(given) && given > 0 ? given : fallback;
  }

  const duplicate = await prisma.wardRule.findFirst({
    where: {
      wardId,
      groupId: scope.groupId,
      type,
      tierId: tierId || null,
      shiftCode: shiftCode || null,
    },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "That rule is already set for this scope" },
      { status: 409 },
    );
  }

  const rule = await prisma.wardRule.create({
    data: {
      wardId,
      groupId: scope.groupId,
      type,
      params: cleaned,
      tierId: tierId || null,
      shiftCode: shiftCode || null,
    },
    include: { tier: { select: { id: true, name: true } } },
  });
  return NextResponse.json(rule, { status: 201 });
}
