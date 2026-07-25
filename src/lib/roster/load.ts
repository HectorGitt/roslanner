import { prisma } from "@/lib/db";
import { CoverageReq, OffDay, Shift, SolverInput } from "./types";

const DEFAULT_RULES = {
  maxConsecutiveDays: 6,
  maxNightsPerWeek: 3,
  minDaysOffPerWeek: 1,
  noMorningAfterNight: true,
  maxConsecutiveNights: 4,
};

/** Build the solver/validator input for a ward + period from the database. */
export async function loadSolverInput(
  wardId: string,
  startDate: Date,
  days: number,
): Promise<SolverInput> {
  const [staff, requirements, ruleSet] = await Promise.all([
    prisma.staff.findMany({
      where: { wardId, active: true },
      include: { role: true },
      orderBy: [{ role: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.coverageRequirement.findMany({ where: { wardId } }),
    prisma.ruleSet.findUnique({ where: { wardId } }),
  ]);

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
        offDays.push({ staffId: l.staffId, dayIndex: d, hard: l.type === "LEAVE" });
      }
    }
  }

  const coverage: CoverageReq[] = requirements
    .filter((r) => r.required > 0)
    .map((r) => ({ shift: r.shift as Shift, roleId: r.roleId, required: r.required }));

  return {
    days,
    startDate: toISODate(startDate),
    staff: staff.map((s) => ({
      id: s.id,
      name: s.name,
      roleId: s.roleId,
      roleName: s.role.name,
    })),
    coverage,
    rules: ruleSet ?? DEFAULT_RULES,
    offDays,
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
