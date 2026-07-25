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
  const { days, staff, coverage, rules, offDays, startDate } = input;

  // --- Coverage per day/shift/role ---
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
        if (nightRun > rules.maxConsecutiveNights) {
          violations.push({
            type: "MAX_CONSECUTIVE_NIGHTS",
            severity: "HARD",
            message: `${name}: ${nightRun} consecutive nights (max ${rules.maxConsecutiveNights})`,
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
  for (const [roleId, idxs] of byRole.entries()) {
    if (idxs.length < 2) continue;
    const nights = idxs.map((i) => countIn(grid[i], "NIGHT"));
    const weekends = idxs.map((i) =>
      grid[i].reduce(
        (acc, v, d) => acc + (isWorkShift(v) && isWeekend(startDate, d) ? 1 : 0),
        0,
      ),
    );
    const totals = idxs.map((i) => grid[i].filter(isWorkShift).length);
    fairnessCost +=
      spread(nights) * 3 + spread(weekends) * 2 + spread(totals) * 2;

    const meanNights = nights.reduce((a, b) => a + b, 0) / nights.length;
    const meanWeekends = weekends.reduce((a, b) => a + b, 0) / weekends.length;
    const meanTotals = totals.reduce((a, b) => a + b, 0) / totals.length;

    idxs.forEach((sIdx, localIdx) => {
      const st = staff[sIdx];
      const n = nights[localIdx];
      const w = weekends[localIdx];
      const t = totals[localIdx];
      
      // Highly sensitive fairness warnings
      if (Math.abs(n - meanNights) > 0.8) {
        violations.push({
          type: "UNFAIR_SHARE",
          severity: "SOFT",
          message: `${st.name}: ${n} nights (average ${meanNights.toFixed(1)})`,
          staffId: st.id,
          dayIndexes: [],
        });
      }
      if (Math.abs(w - meanWeekends) > 0.8) {
        violations.push({
          type: "UNFAIR_SHARE",
          severity: "SOFT",
          message: `${st.name}: ${w} weekend shifts (average ${meanWeekends.toFixed(1)})`,
          staffId: st.id,
          dayIndexes: [],
        });
      }
      if (Math.abs(t - meanTotals) > 1.5) {
        violations.push({
          type: "UNFAIR_SHARE",
          severity: "SOFT",
          message: `${st.name}: ${t} total shifts (average ${meanTotals.toFixed(1)})`,
          staffId: st.id,
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
