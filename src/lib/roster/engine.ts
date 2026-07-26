import {
  CellValue,
  Evaluation,
  Grid,
  Shift,
  SHIFTS,
  SolverInput,
  Violation,
} from "./types";

const HARD_WEIGHT = 10_000;
const SOFT_WEIGHT = 50;
const FAIRNESS_WEIGHT = 1;

export function isWorkShift(v: CellValue): v is Shift {
  return v !== "DO";
}

/** Day-of-week (0=Sun..6=Sat) for a day index relative to startDate. */
export function dayOfWeek(startDate: string, dayIndex: number): number {
  const d = new Date(startDate + "T00:00:00");
  d.setDate(d.getDate() + dayIndex);
  return d.getDay();
}

export function isWeekend(startDate: string, dayIndex: number): boolean {
  const dow = dayOfWeek(startDate, dayIndex);
  return dow === 0 || dow === 6;
}

/**
 * Evaluate a grid against all constraints.
 * Hard violations: coverage shortfall, working on hard leave, rest rules.
 * Soft: unmet DO requests. Fairness: spread of nights/weekends/totals per role.
 */
export function evaluate(input: SolverInput, grid: Grid): Evaluation {
  const violations: Violation[] = [];
  const { days, staff, coverage, rules, offDays, startDate, tiers, tierPairings } = input;
  const tierById = new Map(tiers.map((t) => [t.id, t]));

  // --- Coverage per day/shift/role ---
  // NOTE: StaffTier.countsTowardClinicalCoverage is deliberately NOT applied to
  // role-based requirements. Role coverage is already role-specific (a porter
  // never satisfies a "Nurse" requirement), and excluding support staff here
  // would make an explicit support-role requirement unsatisfiable. The flag
  // takes effect for tier-scoped coverage requirements.
  for (let d = 0; d < days; d++) {
    const counts = new Map<string, number>(); // `${shift}|${roleId}` -> assigned
    for (let s = 0; s < staff.length; s++) {
      const v = grid[s][d];
      if (isWorkShift(v)) {
        const key = `${v}|${staff[s].roleId}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    for (const req of coverage) {
      const have = counts.get(`${req.shift}|${req.roleId}`) ?? 0;
      if (have < req.required) {
        violations.push({
          type: "COVERAGE_SHORTFALL",
          severity: "HARD",
          message: `Day ${d + 1}: ${req.shift.toLowerCase()} needs ${req.required}, has ${have} (${roleName(input, req.roleId)})`,
          dayIndexes: [d],
        });
      }
    }

    // --- Tier pairing ("Tier 3 must always have >=N Tier 2 present") ---
    if (tierPairings.length > 0) {
      for (const shift of SHIFTS) {
        const tierCounts = new Map<string, number>();
        for (let s = 0; s < staff.length; s++) {
          if (grid[s][d] !== shift || !staff[s].tierId) continue;
          const tid = staff[s].tierId!;
          tierCounts.set(tid, (tierCounts.get(tid) ?? 0) + 1);
        }
        for (const p of tierPairings) {
          if (p.shift && p.shift !== shift) continue;
          const dependentPresent = (tierCounts.get(p.dependentTierId) ?? 0) > 0;
          if (!dependentPresent) continue;
          const requiredPresent = tierCounts.get(p.requiredTierId) ?? 0;
          if (requiredPresent < p.minRequiredCount) {
            violations.push({
              type: "TIER_PAIRING_UNMET",
              severity: "HARD",
              message: `Day ${d + 1}: ${shift.toLowerCase()} has ${tierName(input, p.dependentTierId)} without ${p.minRequiredCount > 1 ? `${p.minRequiredCount}x ` : ""}${tierName(input, p.requiredTierId)} present`,
              dayIndexes: [d],
            });
          }
        }
      }
    }
  }

  // --- Off-day handling ---
  const hardOff = new Set<string>();
  const softOff = new Set<string>();
  for (const o of offDays) {
    (o.hard ? hardOff : softOff).add(`${o.staffId}|${o.dayIndex}`);
  }
  for (let s = 0; s < staff.length; s++) {
    for (let d = 0; d < days; d++) {
      if (!isWorkShift(grid[s][d])) continue;
      const key = `${staff[s].id}|${d}`;
      if (hardOff.has(key)) {
        violations.push({
          type: "HARD_LEAVE_BROKEN",
          severity: "HARD",
          message: `${staff[s].name} is scheduled on approved leave (day ${d + 1})`,
          staffId: staff[s].id,
          dayIndexes: [d],
        });
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

    if (rules.noMorningAfterNight) {
      for (let d = 1; d < days; d++) {
        if (row[d - 1] === "NIGHT" && row[d] === "MORNING") {
          violations.push({
            type: "MORNING_AFTER_NIGHT",
            severity: "HARD",
            message: `${name}: morning shift straight after a night (day ${d + 1})`,
            staffId: staff[s].id,
            dayIndexes: [d - 1, d],
          });
        }
      }
    }

    // Tier shift eligibility (e.g. Tier 1 = Morning only, never weekends)
    const tier = staff[s].tierId ? tierById.get(staff[s].tierId!) : undefined;
    if (tier) {
      const shiftRuleByShift = new Map(tier.shiftRules.map((r) => [r.shift, r]));
      for (let d = 0; d < days; d++) {
        const v = row[d];
        if (!isWorkShift(v)) continue;
        const shiftRule = shiftRuleByShift.get(v);
        const weekend = isWeekend(startDate, d);
        if (shiftRule?.eligible === false) {
          violations.push({
            type: "TIER_SHIFT_INELIGIBLE",
            severity: "HARD",
            message: `${name} (${tier.name}) isn't eligible for ${v.toLowerCase()} shifts (day ${d + 1})`,
            staffId: staff[s].id,
            dayIndexes: [d],
          });
        } else if (weekend && shiftRule?.weekendEligible === false) {
          violations.push({
            type: "TIER_SHIFT_INELIGIBLE",
            severity: "HARD",
            message: `${name} (${tier.name}) isn't eligible for weekend shifts (day ${d + 1})`,
            staffId: staff[s].id,
            dayIndexes: [d],
          });
        }
      }
    }
    // A tier override may only tighten the ward's limit, never loosen it.
    const effectiveMaxNights = Math.min(
      rules.maxConsecutiveNights,
      tier?.maxConsecutiveNights ?? Infinity,
    );

    // Consecutive working days / nights
    let run = 0;
    let nightRun = 0;
    for (let d = 0; d <= days; d++) {
      const working = d < days && isWorkShift(row[d]);
      const night = d < days && row[d] === "NIGHT";
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

    // Weekly rules on consecutive 7-day blocks from start
    for (let w = 0; w * 7 < days; w++) {
      const start = w * 7;
      const end = Math.min(start + 7, days);
      const fullWeek = end - start === 7;
      let nights = 0;
      let dos = 0;
      for (let d = start; d < end; d++) {
        if (row[d] === "NIGHT") nights++;
        if (row[d] === "DO") dos++;
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
  // Staff a tier bars from a shift (or from weekends) are excluded from that
  // fairness pool — otherwise a morning-only senior looks permanently
  // "short of nights" and the solver burns effort chasing an impossible fix.
  const shiftEligible = (sIdx: number, shift: Shift): boolean => {
    const tierId = staff[sIdx].tierId;
    const t = tierId ? tierById.get(tierId) : undefined;
    if (!t) return true;
    return t.shiftRules.find((r) => r.shift === shift)?.eligible ?? true;
  };
  const weekendEligible = (sIdx: number): boolean => {
    const tierId = staff[sIdx].tierId;
    const t = tierId ? tierById.get(tierId) : undefined;
    if (!t || t.shiftRules.length === 0) return true;
    return t.shiftRules.some((r) => r.eligible && r.weekendEligible);
  };

  for (const idxs of byRole.values()) {
    if (idxs.length < 2) continue;

    const nightPool = idxs.filter((i) => shiftEligible(i, "NIGHT"));
    const weekendPool = idxs.filter(weekendEligible);

    const nights = nightPool.map((i) => countIn(grid[i], "NIGHT"));
    const weekends = weekendPool.map((i) =>
      grid[i].reduce(
        (acc, v, d) => acc + (isWorkShift(v) && isWeekend(startDate, d) ? 1 : 0),
        0,
      ),
    );
    const totals = idxs.map((i) => grid[i].filter(isWorkShift).length);
    fairnessCost +=
      (nights.length > 1 ? spread(nights) * 3 : 0) +
      (weekends.length > 1 ? spread(weekends) * 2 : 0) +
      spread(totals) * 2;

    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const meanTotals = mean(totals);

    if (nights.length > 1) {
      const meanNights = mean(nights);
      nightPool.forEach((sIdx, localIdx) => {
        if (Math.abs(nights[localIdx] - meanNights) > 0.8) {
          violations.push({
            type: "UNFAIR_SHARE",
            severity: "SOFT",
            message: `${staff[sIdx].name}: ${nights[localIdx]} nights (average ${meanNights.toFixed(1)})`,
            staffId: staff[sIdx].id,
            dayIndexes: [],
          });
        }
      });
    }
    if (weekends.length > 1) {
      const meanWeekends = mean(weekends);
      weekendPool.forEach((sIdx, localIdx) => {
        if (Math.abs(weekends[localIdx] - meanWeekends) > 0.8) {
          violations.push({
            type: "UNFAIR_SHARE",
            severity: "SOFT",
            message: `${staff[sIdx].name}: ${weekends[localIdx]} weekend shifts (average ${meanWeekends.toFixed(1)})`,
            staffId: staff[sIdx].id,
            dayIndexes: [],
          });
        }
      });
    }
    idxs.forEach((sIdx, localIdx) => {
      if (Math.abs(totals[localIdx] - meanTotals) > 1.5) {
        violations.push({
          type: "UNFAIR_SHARE",
          severity: "SOFT",
          message: `${staff[sIdx].name}: ${totals[localIdx]} total shifts (average ${meanTotals.toFixed(1)})`,
          staffId: staff[sIdx].id,
          dayIndexes: [],
        });
      }
    });
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

function roleName(input: SolverInput, roleId: string): string {
  return input.staff.find((s) => s.roleId === roleId)?.roleName ?? "staff";
}

function tierName(input: SolverInput, tierId: string): string {
  return input.tiers.find((t) => t.id === tierId)?.name ?? "tier";
}

function countIn(row: CellValue[], v: CellValue): number {
  return row.reduce((a, c) => a + (c === v ? 1 : 0), 0);
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

export { SHIFTS };
