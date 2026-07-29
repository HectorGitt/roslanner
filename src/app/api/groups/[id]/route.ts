import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHospitalUser } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { id } = await params;
  const own = await prisma.staffGroup.findFirst({
    where: { id, hospitalId: guard.user.hospitalId },
  });
  if (!own) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, sortOrder } = await req.json();
  const group = await prisma.staffGroup.update({
    where: { id },
    data: {
      ...(typeof name === "string" && name.trim() ? { name: name.trim().slice(0, 80) } : {}),
      ...(sortOrder !== undefined ? { sortOrder: Math.floor(Number(sortOrder)) || 0 } : {}),
    },
  });
  return NextResponse.json(group);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireHospitalUser();
  if (guard.response) return guard.response;

  const { id } = await params;
  const own = await prisma.staffGroup.findFirst({
    where: { id, hospitalId: guard.user.hospitalId },
  });
  if (!own) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Deleting a group that still owns config would either destroy those rules or
  // silently widen them to the whole ward. Say what is in the way instead.
  const [rosters, shifts, requirements, ruleSets, wardRules] = await Promise.all([
    prisma.roster.count({ where: { groupId: id } }),
    prisma.shiftDefinition.count({ where: { groupId: id } }),
    prisma.coverageRequirement.count({ where: { groupId: id } }),
    prisma.ruleSet.count({ where: { groupId: id } }),
    prisma.wardRule.count({ where: { groupId: id } }),
  ]);
  const blockers = [
    rosters && `${rosters} roster${rosters === 1 ? "" : "s"}`,
    shifts && `${shifts} shift${shifts === 1 ? "" : "s"}`,
    requirements && `${requirements} coverage requirement${requirements === 1 ? "" : "s"}`,
    ruleSets && "its own rules",
    wardRules && `${wardRules} additional rule${wardRules === 1 ? "" : "s"}`,
  ].filter(Boolean);
  if (blockers.length > 0) {
    return NextResponse.json(
      {
        error: `Still in use by ${blockers.join(", ")}. Remove those first, or leave the group in place.`,
      },
      { status: 409 },
    );
  }

  // Roles are only untagged, never deleted.
  await prisma.staffGroup.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
