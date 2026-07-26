import { addDays, dayOfWeek as dayOfWeekUTC, parseISODate } from "@/lib/dates";
import {
  CellValue,
  DAY_OFF,
  Evaluation,
  Grid,
  OffDay,
  PriorStats,
  Shift,
  SolverInput,
  Violation,
} from "./types";

const HARD_WEIGHT = 10_000;
const SOFT_WEIGHT = 50;
const FAIRNESS_WEIGHT = 1;

export function isWorkShift(v: CellValue): v is Shift {
  return v !== DAY_OFF;
}

/** Day-of-week (0=Sun..6=Sat) for a day index relative to startDate. */
export function dayOfWeek(startDate: string, dayIndex: number): number {
  return dayOfWeekUTC(addDays(parseISODate(startDate), dayIndex));
}

export function isWeekend(startDate: string, dayIndex: number): boolean {
  const dow = dayOfWeek(startDate, dayIndex);
  return dow === 0 || dow === 6;
}

/**
 * Hours of rest between a shift worked on one day and a shift worked the next.
 * Shift times are minutes-from-midnight; a shift flagged crossesMidnight ends
 * on the following calendar day.
 */
export function restHoursBetween(
  prev: { endMinutes: number; crossesMidnight: boolean },
  next: { startMinutes: number },
): number {
  const prevEnd = prev.crossesMidnight ? prev.endMinutes + 24 * 60 : prev.endMinutes;
  const nextStart = next.startMinutes + 24 * 60; // next calendar day
  return (nextStart - prevEnd) / 60;
}

/**
 * Evaluate a grid against every constraint. Pure and synchronous — the solver
 * calls it tens of thousands of times, so everything it needs (shift times,
 * tiers, coverage, leave) must already be on `input`.
 */
export function evaluate(input: SolverInput, grid: Grid): Evaluation {
  const violations: Violation[] = [];
  const {
    days,
    staff,
    coverage,
    rules,
    offDays,
    startDate,
    tiers,
    tierPairings,
    shiftDefs,
    externalShifts,
    publicHolidayDayIndexes,
    priorStats,
  } = input;
  const isHoliday = new Set(publicHolidayDayIndexes);
  const priorByStaff = new Map(priorStats.map((p) => [p.staffId, p]));

  const tierById = new Map(tiers.map((t) => [t.id, t]));
  const defByCode = new Map(shiftDefs.map((sd) => [sd.code, sd]));
  // Shifts worked in other wards, keyed by staff+day (day -1 included).
  const externalByStaffDay = new Map(
    externalShifts.map((e) => [`${e.staffId}|${e.dayIndex}`, { ...e, label: e.shiftLabel }]),
  );
  const isNight = (v: CellValue) => defByCode.get(v)?.isNightLike ?? false;
  // Shift codes actually present in this ward, in display order.
  const shiftCodes = shiftDefs.map((sd) => sd.code);
  const nightCodes = shiftDefs.filter((sd) => sd.isNightLike).map((sd) => sd.code);

  // --- Coverage per day/shift, scoped by role and/or tier ---
  for (let d = 0; d < days; d++) {
    for (const req of coverage) {
      let have = 0;
      for (let s = 0; s < staff.length; s++) {
        if (grid[s][d] !== req.shift) continue;
        if (req.roleId && staff[s].roleId !== req.roleId) continue;
        if (req.tierId) {
          if (staff[s].tierId !== req.tierId) continue;
        } else if (!req.roleId) {
          // Plain headcount floor: support tiers are rostered but don't count
          // toward clinical coverage.
          const t = staff[s].tierId ? tierById.get(staff[s].tierId!) : undefined;
          if (t && !t.countsTowardClinicalCoverage) continue;
        }
        have++;
      }
      if (have < req.required) {
        violations.push({
          type: "COVERAGE_SHORTFALL",
          severity: "HARD",
          message: `Day ${d + 1}: ${shiftLabel(input, req.shift)} needs ${req.required} ${scopeLabel(input, req)}, has ${have}`,
          dayIndexes: [d],
        });
      }
    }

    // --- Tier pairing ("an intern is never on shift without a senior") ---
    if (tierPairings.length > 0) {
      for (const shift of shiftCodes) {
        const tierCounts = new Map<string, number>();
        for (let s = 0; s < staff.length; s++) {
          const tid = staff[s].tierId;
          if (grid[s][d] !== shift || !tid) continue;
          tierCounts.set(tid, (tierCounts.get(tid) ?? 0) + 1);
        }
        for (const p of tierPairings) {
          if (p.shift && p.shift !== shift) continue;
          if ((tierCounts.get(p.dependentTierId) ?? 0) === 0) continue;
          const present = tierCounts.get(p.requiredTierId) ?? 0;
          if (present < p.minRequiredCount) {
            violations.push({
              type: "TIER_PAIRING_UNMET",
              severity: "HARD",
              message: `Day ${d + 1}: ${shiftLabel(input, shift)} has ${tierName(input, p.dependentTierId)} without ${p.minRequiredCount > 1 ? `${p.minRequiredCount}x ` : ""}${tierName(input, p.requiredTierId)} present`,
              dayIndexes: [d],
            });
          }
        }
      }
    }
  }

  // --- Off-day handling ---
  const hardOff = new Map<string, OffDay>();
  const softOff = new Set<string>();
  for (const o of offDays) {
    if (o.hard) hardOff.set(`${o.staffId}|${o.dayIndex}`, o);
    else softOff.add(`${o.staffId}|${o.dayIndex}`);
  }
  for (let s = 0; s < staff.length; s++) {
    for (let d = 0; d < days; d++) {
      if (!isWorkShift(grid[s][d])) continue;
      const key = `${staff[s].id}|${d}`;
      const blocked = hardOff.get(key);
      if (blocked) {
        violations.push(
          blocked.reason === "OTHER_WARD"
            ? {
                type: "COMMITTED_ELSEWHERE",
                severity: "HARD",
                message: `${staff[s].name} is already working in ${blocked.detail ?? "another ward"} on day ${d + 1}`,
                staffId: staff[s].id,
                dayIndexes: [d],
              }
            : {
                type: "HARD_LEAVE_BROKEN",
                severity: "HARD",
                message: `${staff[s].name} is scheduled on approved leave (day ${d + 1})`,
                staffId: staff[s].id,
                dayIndexes: [d],
              },
        );
      } else if (softOff.has(key)) {
        violations.push({
          type: "DO_REQUEST_UNMET",
          severity: "SOFT",
          message: `${staff[s].name}'s day-off request for day ${d + 1} not honoured`,
          staffId: staff[s].id,
          dayIndexes: [d],
        });
      }
    }
  }

  // --- Per-staff sequence rules ---
  for (let s = 0; s < staff.length; s++) {
    const row = grid[s];
    const name = staff[s].name;
    const tier = staff[s].tierId ? tierById.get(staff[s].tierId!) : undefined;

    // Rest between consecutive days, from each shift's real times. A shift the
    // person works in another ward counts too, so a floater can't finish late
    // there and start early here.
    if (rules.minRestHours !== null) {
      for (let d = 0; d < days; d++) {
        const next = defByCode.get(row[d]);
        if (!next) continue; // a day off needs no rest check
        // Yesterday was either a shift here, or one in another ward.
        const here = d > 0 ? defByCode.get(row[d - 1]) : undefined;
        const away = externalByStaffDay.get(`${staff[s].id}|${d - 1}`);
        const prev = here ?? away;
        if (!prev) continue;
        const rest = restHoursBetween(prev, next);
        if (rest < rules.minRestHours) {
          const where = here ? "" : ` in ${away!.wardName}`;
          violations.push({
            type: "INSUFFICIENT_REST",
            severity: "HARD",
            message: `${name}: only ${rest}h rest after ${prev.label}${where} before ${next.label} (day ${d + 1}, min ${rules.minRestHours}h)`,
            staffId: staff[s].id,
            dayIndexes: d > 0 ? [d - 1, d] : [d],
          });
        }
      }
    }

    // Tier shift eligibility (e.g. senior staff on mornings only, no weekends)
    if (tier) {
      const ruleFor = new Map(tier.shiftRules.map((r) => [r.shift, r]));
      for (let d = 0; d < days; d++) {
        const v = row[d];
        if (!isWorkShift(v)) continue;
        const shiftRule = ruleFor.get(v);
        if (shiftRule?.eligible === false) {
          violations.push({
            type: "TIER_SHIFT_INELIGIBLE",
            severity: "HARD",
            message: `${name} (${tier.name}) isn't eligible for ${shiftLabel(input, v)} shifts (day ${d + 1})`,
            staffId: staff[s].id,
            dayIndexes: [d],
          });
        } else if (isWeekend(startDate, d) && shiftRule?.weekendEligible === false) {
          violations.push({
            type: "TIER_SHIFT_INELIGIBLE",
            severity: "HARD",
            message: `${name} (${tier.name}) isn't eligible for weekend shifts (day ${d + 1})`,
            staffId: staff[s].id,
            dayIndexes: [d],
          });
        } else if (isHoliday.has(d) && shiftRule?.holidayEligible === false) {
          violations.push({
            type: "TIER_SHIFT_INELIGIBLE",
            severity: "HARD",
            message: `${name} (${tier.name}) isn't eligible to work public holidays (day ${d + 1})`,
            staffId: staff[s].id,
            dayIndexes: [d],
          });
        }
      }
    }

    // A tier override may only tighten the ward's night limit, never loosen it.
    const effectiveMaxNights = Math.min(
      rules.maxConsecutiveNights,
      tier?.maxConsecutiveNights ?? Infinity,
    );

    // Consecutive working days / nights
    let run = 0;
    let nightRun = 0;
    for (let d = 0; d <= days; d++) {
      const working = d < days && isWorkShift(row[d]);
      const night = d < days && isNight(row[d]);
      if (working) run++;
      else {
        if (run > rules.maxConsecutiveDays) {
          violations.push({
            type: "MAX_CONSECUTIVE_DAYS",
            severity: "HARD",
            message: `${name}: ${run} consecutive working days (max ${rules.maxConsecutiveDays})`,
            staffId: staff[s].id,
            dayIndexes: range(d - run, d),
          });
        }
        run = 0;
      }
      if (night) nightRun++;
      else {
        if (nightRun > effectiveMaxNights) {
          violations.push({
            type: "MAX_CONSECUTIVE_NIGHTS",
            severity: "HARD",
            message: `${name}: ${nightRun} consecutive nights (max ${effectiveMaxNights})`,
            staffId: staff[s].id,
            dayIndexes: range(d - nightRun, d),
          });
        }
        nightRun = 0;
      }
    }

    // Weekly rules on consecutive 7-day blocks from the start of the roster
    for (let w = 0; w * 7 < days; w++) {
      const start = w * 7;
      const end = Math.min(start + 7, days);
      const fullWeek = end - start === 7;
      let nights = 0;
      let dos = 0;
      for (let d = start; d < end; d++) {
        if (isNight(row[d])) nights++;
        if (row[d] === DAY_OFF) dos++;
      }
      if (nights > rules.maxNightsPerWeek) {
        violations.push({
          type: "MAX_NIGHTS_PER_WEEK",
          severity: "HARD",
          message: `${name}: ${nights} nights in week ${w + 1} (max ${rules.maxNightsPerWeek})`,
          staffId: staff[s].id,
          dayIndexes: range(start, end),
        });
      }
      if (fullWeek && dos < rules.minDaysOffPerWeek) {
        violations.push({
          type: "MIN_DAYS_OFF_PER_WEEK",
          severity: "HARD",
          message: `${name}: only ${dos} day(s) off in week ${w + 1} (min ${rules.minDaysOffPerWeek})`,
          staffId: staff[s].id,
          dayIndexes: range(start, end),
        });
      }
    }
  }

  // --- Fairness: spread of nights / weekend shifts / totals within each role ---
  let fairnessCost = 0;
  const byRole = new Map<string, number[]>();
  staff.forEach((st, i) => {
    const list = byRole.get(st.roleId) ?? [];
    list.push(i);
    byRole.set(st.roleId, list);
  });

  // Staff a tier bars from nights (or from weekends) are excluded from that
  // pool — otherwise a morning-only senior looks permanently short of nights
  // and the solver burns effort chasing an impossible fix.
  const nightEligible = (sIdx: number): boolean => {
    const tierId = staff[sIdx].tierId;
    const t = tierId ? tierById.get(tierId) : undefined;
    if (!t) return true;
    if (nightCodes.length === 0) return true;
    return nightCodes.some(
      (code) => t.shiftRules.find((r) => r.shift === code)?.eligible ?? true,
    );
  };
  const weekendEligible = (sIdx: number): boolean => {
    const tierId = staff[sIdx].tierId;
    const t = tierId ? tierById.get(tierId) : undefined;
    if (!t || t.shiftRules.length === 0) return true;
    return t.shiftRules.some((r) => r.eligible && r.weekendEligible);
  };

  const holidayEligible = (sIdx: number): boolean => {
    const tierId = staff[sIdx].tierId;
    const t = tierId ? tierById.get(tierId) : undefined;
    if (!t || t.shiftRules.length === 0) return true;
    return t.shiftRules.some((r) => r.eligible && r.holidayEligible);
  };

  /**
   * Each thing we balance: who it applies to, how much of it someone worked in
   * this roster, what they already worked in the rolling window, and how much
   * an uneven share matters. Counts are divided by FTE so a half-time member of
   * staff is balanced to half the shifts, not the same number.
   */
  const METRICS: {
    label: string;
    pool: (i: number) => boolean;
    inPeriod: (i: number) => number;
    prior: (p: PriorStats) => number;
    weight: number;
    tolerance: number;
  }[] = [
    {
      label: "nights",
      pool: nightEligible,
      inPeriod: (i) => grid[i].reduce((a, v) => a + (isNight(v) ? 1 : 0), 0),
      prior: (p) => p.nights,
      weight: 3,
      tolerance: 0.8,
    },
    {
      label: "weekend shifts",
      pool: weekendEligible,
      inPeriod: (i) =>
        grid[i].reduce(
          (a, v, d) => a + (isWorkShift(v) && isWeekend(startDate, d) ? 1 : 0),
          0,
        ),
      prior: (p) => p.weekends,
      weight: 2,
      tolerance: 0.8,
    },
    {
      label: "public holidays",
      pool: holidayEligible,
      inPeriod: (i) =>
        grid[i].reduce((a, v, d) => a + (isWorkShift(v) && isHoliday.has(d) ? 1 : 0), 0),
      prior: (p) => p.holidays,
      weight: 4, // holidays are scarce and keenly felt, so weigh them highest
      tolerance: 0.5,
    },
    {
      label: "total shifts",
      pool: () => true,
      inPeriod: (i) => grid[i].filter(isWorkShift).length,
      prior: (p) => p.total,
      weight: 2,
      tolerance: 1.5,
    },
  ];

  for (const idxs of byRole.values()) {
    if (idxs.length < 2) continue;

    for (const metric of METRICS) {
      const pool = idxs.filter(metric.pool);
      if (pool.length < 2) continue;

      // Nothing to balance if nobody in the pool has any of this.
      const raw = pool.map((i) => {
        const prior = priorByStaff.get(staff[i].id);
        return metric.inPeriod(i) + (prior ? metric.prior(prior) : 0);
      });
      if (raw.every((n) => n === 0)) continue;

      const rates = pool.map((i, k) => raw[k] / Math.max(staff[i].fte, 0.01));
      const meanRate = rates.reduce((a, b) => a + b, 0) / rates.length;
      fairnessCost += spread(rates) * metric.weight;

      pool.forEach((sIdx, k) => {
        if (Math.abs(rates[k] - meanRate) <= metric.tolerance) return;
        const fte = staff[sIdx].fte;
        const perFte = fte === 1 ? "" : ` at ${fte} FTE`;
        const window =
          priorByStaff.size > 0 && rules.fairnessWindowDays > 0
            ? ` over the last ${rules.fairnessWindowDays} days`
            : "";
        violations.push({
          type: "UNFAIR_SHARE",
          severity: "SOFT",
          message: `${staff[sIdx].name}: ${raw[k]} ${metric.label}${perFte}${window} (average ${meanRate.toFixed(1)})`,
          staffId: staff[sIdx].id,
          dayIndexes: [],
        });
      });
    }
  }

  const hardCount = violations.filter((v) => v.severity === "HARD").length;
  const softCount = violations.length - hardCount;
  return {
    hardCount,
    softCount,
    fairnessCost,
    cost:
      hardCount * HARD_WEIGHT +
      softCount * SOFT_WEIGHT +
      fairnessCost * FAIRNESS_WEIGHT,
    violations,
  };
}

function shiftLabel(input: SolverInput, code: Shift): string {
  return input.shiftDefs.find((sd) => sd.code === code)?.label ?? code.toLowerCase();
}

/** Human description of what a coverage requirement is asking for. */
function scopeLabel(input: SolverInput, req: { roleId?: string; tierId?: string }): string {
  const role = req.roleId
    ? input.staff.find((s) => s.roleId === req.roleId)?.roleName
    : undefined;
  const tier = req.tierId ? tierName(input, req.tierId) : undefined;
  if (role && tier) return `${tier} ${role}`;
  return role ?? tier ?? "staff";
}

function tierName(input: SolverInput, tierId: string): string {
  return input.tiers.find((t) => t.id === tierId)?.name ?? "tier";
}

/** Sum of absolute deviations from the mean — cheap fairness measure. */
function spread(xs: number[]): number {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((a, b) => a + Math.abs(b - mean), 0);
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = Math.max(0, from); i < to; i++) out.push(i);
  return out;
}
