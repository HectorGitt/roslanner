import { prisma } from "@/lib/db";
import {
  CoverageReq,
  ExternalShift,
  OffDay,
  Rules,
  Shift,
  ShiftDef,
  SolverInput,
  TierInfo,
  TierPairing,
} from "./types";

const DEFAULT_RULES: Rules = {
  maxConsecutiveDays: 6,
  maxNightsPerWeek: 3,
  minDaysOffPerWeek: 1,
  maxConsecutiveNights: 4,
  minRestHours: 8,
};

/** Build the solver/validator input for a ward + period from the database. */
export async function loadSolverInput(
  wardId: string,
  startDate: Date,
  days: number,
): Promise<SolverInput> {
  const ward = await prisma.ward.findUniqueOrThrow({
    where: { id: wardId },
    select: { hospitalId: true },
  });

  const [staff, requirements, ruleSet, shiftDefsRaw, tiersRaw, pairingsRaw] =
    await Promise.all([
      // Staff based here, plus anyone from the float pool eligible for this ward.
      prisma.staff.findMany({
        where: {
          active: true,
          OR: [{ wardId }, { floatWards: { some: { wardId } } }],
        },
        include: { role: true, tier: true },
        orderBy: [{ role: { name: "asc" } }, { name: "asc" }],
      }),
      prisma.coverageRequirement.findMany({ where: { wardId } }),
      prisma.ruleSet.findUnique({ where: { wardId } }),
      prisma.shiftDefinition.findMany({
        where: { wardId },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.staffTier.findMany({
        where: { hospitalId: ward.hospitalId },
        include: { shiftEligibility: true },
      }),
      prisma.tierPairingRule.findMany({
        where: { dependentTier: { hospitalId: ward.hospitalId } },
      }),
    ]);

  const shiftDefs: ShiftDef[] = shiftDefsRaw.map((sd) => ({
    code: sd.code,
    label: sd.label,
    startMinutes: sd.startMinutes,
    endMinutes: sd.endMinutes,
    crossesMidnight: sd.crossesMidnight,
    isNightLike: sd.isNightLike,
    sortOrder: sd.sortOrder,
  }));

  // Tier rules are keyed by shift code, so they apply in every ward that uses
  // that shift — no per-ward resolution needed.
  const tiers: TierInfo[] = tiersRaw.map((t) => ({
    id: t.id,
    name: t.name,
    countsTowardClinicalCoverage: t.countsTowardClinicalCoverage,
    maxConsecutiveNights: t.maxConsecutiveNights,
    shiftRules: t.shiftEligibility.map((e) => ({
      shift: e.shiftCode as Shift,
      eligible: e.eligible,
      weekendEligible: e.weekendEligible,
      holidayEligible: e.holidayEligible,
    })),
  }));

  const tierPairings: TierPairing[] = pairingsRaw.map((p) => ({
    dependentTierId: p.dependentTierId,
    requiredTierId: p.requiredTierId,
    minRequiredCount: p.minRequiredCount,
    shift: (p.shiftCode as Shift | null) ?? undefined,
  }));

  const staffIds = staff.map((s) => s.id);
  const periodEnd = addDays(startDate, days); // exclusive
  const leave = await prisma.leaveRequest.findMany({
    where: {
      staffId: { in: staffIds },
      startDate: { lt: periodEnd },
      endDate: { gte: startDate },
    },
  });

  const offDays: OffDay[] = [];
  for (const l of leave) {
    for (let d = 0; d < days; d++) {
      const day = addDays(startDate, d);
      if (day >= stripTime(l.startDate) && day <= stripTime(l.endDate)) {
        offDays.push({
          staffId: l.staffId,
          dayIndex: d,
          hard: l.type === "LEAVE",
          reason: l.type === "LEAVE" ? "LEAVE" : "REQUEST",
        });
      }
    }
  }

  // Days these people are already committed to another ward. Those days are
  // unavailable here, and the shift they work there constrains rest either side
  // — including the day before this roster starts.
  const externalCommitments = await prisma.staffDailyCommitment.findMany({
    where: {
      staffId: { in: staffIds },
      wardId: { not: wardId },
      date: { gte: addDays(startDate, -1), lt: periodEnd },
    },
    include: { ward: { select: { name: true } } },
  });

  // Shift times come from the *other* ward's definitions.
  const otherShiftDefs = await prisma.shiftDefinition.findMany({
    where: {
      wardId: { in: [...new Set(externalCommitments.map((c) => c.wardId))] },
    },
  });
  const otherDefKey = new Map(
    otherShiftDefs.map((sd) => [`${sd.wardId}|${sd.code}`, sd]),
  );

  const externalShifts: ExternalShift[] = [];
  for (const c of externalCommitments) {
    const dayIndex = Math.round(
      (stripTime(c.date).getTime() - stripTime(startDate).getTime()) / 86_400_000,
    );
    const def = otherDefKey.get(`${c.wardId}|${c.shiftCode}`);
    if (!def) continue; // that ward dropped the shift; nothing to compare times against
    externalShifts.push({
      staffId: c.staffId,
      dayIndex,
      startMinutes: def.startMinutes,
      endMinutes: def.endMinutes,
      crossesMidnight: def.crossesMidnight,
      shiftLabel: def.label,
      wardName: c.ward.name,
    });
    // Days inside this period are simply unavailable here.
    if (dayIndex >= 0 && dayIndex < days) {
      offDays.push({
        staffId: c.staffId,
        dayIndex,
        hard: true,
        reason: "OTHER_WARD",
        detail: c.ward.name,
      });
    }
  }

  // Drop requirements for shifts this ward no longer defines — otherwise they'd
  // report shortfalls for a shift nobody can be assigned to.
  const validCodes = new Set(shiftDefs.map((sd) => sd.code));
  const coverage: CoverageReq[] = requirements
    .filter((r) => r.required > 0 && validCodes.has(r.shift))
    .map((r) => ({
      shift: r.shift as Shift,
      roleId: r.roleId ?? undefined,
      tierId: r.tierId ?? undefined,
      required: r.required,
    }));

  return {
    days,
    startDate: toISODate(startDate),
    staff: staff.map((s) => ({
      id: s.id,
      name: s.name,
      roleId: s.roleId,
      roleName: s.role.name,
      tierId: s.tierId ?? undefined,
      tierName: s.tier?.name,
      fte: s.fte,
      canBeLead: s.canBeLead,
    })),
    coverage,
    rules: ruleSet ?? DEFAULT_RULES,
    offDays,
    tiers,
    tierPairings,
    shiftDefs,
    externalShifts,
    homeWardId: wardId,
    floatStaffIds: staff.filter((s) => s.wardId !== wardId).map((s) => s.id),
  };
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const out = stripTime(d);
  out.setDate(out.getDate() + n);
  return out;
}

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
