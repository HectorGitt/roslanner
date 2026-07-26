import { addDays, dayOfWeek as dayOfWeekUTC, parseISODate } from "@/lib/dates";
import {
  CellValue,
  CoverageReq,
  DAY_OFF,
  Evaluation,
  Grid,
  OffDay,
  PriorStats,
  Shift,
  ViolationType,
  SolverInput,
  Violation,
} from "./types";

const HARD_WEIGHT = 10_000;
const SOFT_WEIGHT = 50;
const FAIRNESS_WEIGHT = 1;

/**
 * Not all hard violations are equally bad, and with a flat weight the solver
 * will happily trade one for another. A coverage shortfall is a visible gap a
 * planner can fill by calling someone in; rostering a person on approved leave,
 * onto a shift their tier bars them from, or into two wards at once breaches
 * their entitlements and should never be preferred to a gap. Everything not
 * listed weighs 1.
 */
const VIOLATION_WEIGHT: Partial<Record<ViolationType, number>> = {
  HARD_LEAVE_BROKEN: 3,
  COMMITTED_ELSEWHERE: 3,
  TIER_SHIFT_INELIGIBLE: 3,
  TIER_PAIRING_UNMET: 2,
  INSUFFICIENT_REST: 2,
};

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
    wardRules,
    chargeLeads,
  } = input;
  const isHoliday = new Set(publicHolidayDayIndexes);
  const priorByStaff = new Map(priorStats.map((p) => [p.staffId, p]));
  /**
   * History is counted over a window that is usually much longer than the
   * roster, so it has to be scaled to this roster's length before being added
   * to in-period counts. Added raw, a 30-day history (up to ~20 shifts) swamps a
   * 7-day roster (0–7) and anyone new — with no history at all — gets loaded to
   * their limit on the first days, leaving the last day of the period unstaffed.
   */
  const priorScale =
    rules.fairnessWindowDays > 0 ? days / rules.fairnessWindowDays : 0;

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
      if (!coverageAppliesOn(req, d, startDate, isHoliday)) continue;
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

  // --- Parameterised ward rules -------------------------------------------
  // One branch per rule type: the meaning of a rule lives here, only its
  // thresholds and scope come from the database.
  for (const rule of wardRules) {
    switch (rule.type) {
      case "BLOCK_PATTERN_ON_OFF": {
        // A stretch of nights must be followed by at least as long off, which is
        // a shape over the whole period rather than a per-day or weekly tally.
        const blockDays = num(rule.params.blockDays, 7);
        if (blockDays < 1) break;
        for (let s = 0; s < staff.length; s++) {
          if (rule.tierId && staff[s].tierId !== rule.tierId) continue;
          const row = grid[s];
          let runStart = -1;
          for (let d = 0; d <= days; d++) {
            const night = d < days && isNight(row[d]);
            if (night && runStart < 0) runStart = d;
            if (!night && runStart >= 0) {
              const runLength = d - runStart;
              if (runLength >= blockDays) {
                // Every day in the following block must be off, as far as this
                // roster reaches — a run finishing at the very end constrains
                // the next period, which is that roster's problem.
                const offEnd = Math.min(d + runLength, days);
                const worked = [];
                for (let k = d; k < offEnd; k++) if (isWorkShift(row[k])) worked.push(k);
                if (worked.length > 0) {
                  violations.push({
                    type: "BLOCK_PATTERN_BROKEN",
                    severity: "HARD",
                    message: `${staff[s].name}: ${runLength} nights in a row must be followed by ${runLength} days off, but works day ${worked[0] + 1}`,
                    staffId: staff[s].id,
                    dayIndexes: [runStart, ...worked],
                  });
                }
              }
              runStart = -1;
            }
          }
        }
        break;
      }

      case "MAX_HOURS_PER_WEEK": {
        const maxHours = num(rule.params.hours, 48);
        for (let s = 0; s < staff.length; s++) {
          if (rule.tierId && staff[s].tierId !== rule.tierId) continue;
          // Rolling, not calendar: any seven consecutive days.
          for (let start = 0; start + 7 <= days; start++) {
            let hours = 0;
            for (let d = start; d < start + 7; d++) {
              const def = defByCode.get(grid[s][d]);
              if (def) hours += shiftHours(def);
            }
            if (hours > maxHours) {
              violations.push({
                type: "MAX_HOURS_PER_WEEK",
                severity: "HARD",
                message: `${staff[s].name}: ${hours}h in the 7 days from day ${start + 1} (max ${maxHours}h)`,
                staffId: staff[s].id,
                dayIndexes: range(start, start + 7),
              });
              break; // one report per person is enough to act on
            }
          }
        }
        break;
      }

      case "CHARGE_LEAD_REQUIRED": {
        const leadKey = new Set(
          chargeLeads.map((l) => `${l.dayIndex}|${l.shiftCode}`),
        );
        const leadBy = new Map(
          chargeLeads.map((l) => [`${l.dayIndex}|${l.shiftCode}`, l.staffId]),
        );
        const canLead = new Map(staff.map((s) => [s.id, s.canBeLead]));
        for (let d = 0; d < days; d++) {
          for (const sd of shiftDefs) {
            if (rule.shiftCode && rule.shiftCode !== sd.code) continue;
            // Only shifts somebody actually works need a lead.
            const onShift = staff.filter((_, i) => grid[i][d] === sd.code);
            if (onShift.length === 0) continue;
            const key = `${d}|${sd.code}`;
            if (!leadKey.has(key)) {
              violations.push({
                type: "CHARGE_LEAD_MISSING",
                severity: "HARD",
                message: `Day ${d + 1}: ${sd.label} has nobody in charge`,
                dayIndexes: [d],
              });
              continue;
            }
            const leadId = leadBy.get(key)!;
            const stillOn = onShift.some((s) => s.id === leadId);
            if (!stillOn || !canLead.get(leadId)) {
              violations.push({
                type: "CHARGE_LEAD_NOT_ELIGIBLE",
                severity: "HARD",
                message: `Day ${d + 1}: ${sd.label} is led by someone ${stillOn ? "not marked as able to lead" : "no longer on that shift"}`,
                staffId: leadId,
                dayIndexes: [d],
              });
            }
          }
        }
        break;
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
      const inPeriod = pool.map(metric.inPeriod);
      const combined = pool.map((i, k) => {
        const prior = priorByStaff.get(staff[i].id);
        return inPeriod[k] + (prior ? metric.prior(prior) * priorScale : 0);
      });
      if (combined.every((n) => n === 0)) continue;

      const rates = pool.map((i, k) => combined[k] / Math.max(staff[i].fte, 0.01));
      const meanRate = rates.reduce((a, b) => a + b, 0) / rates.length;
      fairnessCost += spread(rates) * metric.weight;

      pool.forEach((sIdx, k) => {
        if (Math.abs(rates[k] - meanRate) <= metric.tolerance) return;
        const fte = staff[sIdx].fte;
        const perFte = fte === 1 ? "" : ` at ${fte} FTE`;
        const context =
          priorScale > 0 ? ` counting the last ${rules.fairnessWindowDays} days` : "";
        // Report what they actually work this roster; the fair share is the
        // pool average converted back from the per-FTE rate.
        const share = (meanRate * fte).toFixed(1);
        violations.push({
          type: "UNFAIR_SHARE",
          severity: "SOFT",
          message: `${staff[sIdx].name}: ${inPeriod[k]} ${metric.label}${perFte} against a fair share of ${share}${context}`,
          staffId: staff[sIdx].id,
          dayIndexes: [],
        });
      });
    }
  }

  const hardCount = violations.filter((v) => v.severity === "HARD").length;
  const softCount = violations.length - hardCount;
  const hardCost = violations.reduce(
    (sum, v) =>
      v.severity === "HARD" ? sum + HARD_WEIGHT * (VIOLATION_WEIGHT[v.type] ?? 1) : sum,
    0,
  );
  return {
    hardCount,
    softCount,
    fairnessCost,
    cost: hardCost + softCount * SOFT_WEIGHT + fairnessCost * FAIRNESS_WEIGHT,
    violations,
  };
}

/**
 * Whether a coverage requirement is in force on a given day. Requirements used
 * to apply to every day, which can't express a clinic that shuts at weekends or
 * skeleton cover on a public holiday.
 */
export function coverageAppliesOn(
  req: CoverageReq,
  dayIndex: number,
  startDate: string,
  isHoliday: Set<number>,
): boolean {
  const holiday = isHoliday.has(dayIndex);
  if (req.holidayRule === "ONLY") return holiday;
  if (req.holidayRule === "EXCLUDE" && holiday) return false;
  if (req.daysOfWeek.length === 0) return true;
  return req.daysOfWeek.includes(dayOfWeek(startDate, dayIndex));
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

/** Read a numeric rule parameter, falling back when it's absent or malformed. */
function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Length of a shift in hours, accounting for one that runs past midnight. */
export function shiftHours(def: { startMinutes: number; endMinutes: number; crossesMidnight: boolean }): number {
  const end = def.crossesMidnight ? def.endMinutes + 24 * 60 : def.endMinutes;
  return (end - def.startMinutes) / 60;
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
