import { evaluate, isWeekend, isWorkShift, restHoursBetween } from "./engine";
import {
  CellValue,
  DAY_OFF,
  Grid,
  Shift,
  ShiftDef,
  SolveResult,
  SolverInput,
} from "./types";

const TIME_BUDGET_MS = 2000;
const MAX_ITERATIONS = 60_000;

/**
 * Two-phase heuristic solver:
 *  1. Greedy day-by-day construction that fills coverage while respecting
 *     hard rest/eligibility rules and leave.
 *  2. Local search (hill climbing with occasional sideways moves) over
 *     swap / reassign moves, scored by the shared evaluate() function.
 *
 * The shift vocabulary comes entirely from input.shiftDefs, so a ward running
 * Day/Call-Duty is solved by the same code as one running Morning/Afternoon/Night.
 */
export function solve(input: SolverInput): SolveResult {
  const started = Date.now();
  const grid = greedyConstruct(input);

  let best = evaluate(input, grid);
  let iterations = 0;
  const nStaff = input.staff.length;
  const roleMates = buildRoleMates(input);
  const cellChoices: CellValue[] = [...input.shiftDefs.map((sd) => sd.code), DAY_OFF];

  while (
    iterations < MAX_ITERATIONS &&
    Date.now() - started < TIME_BUDGET_MS &&
    best.cost > 0
  ) {
    iterations++;
    const d = randInt(input.days);
    let undo: (() => void) | null = null;

    if (Math.random() < 0.6 && nStaff >= 2) {
      // Swap two same-role staff on one day (coverage-preserving)
      const a = randInt(nStaff);
      const mates = roleMates[a];
      if (mates.length === 0) continue;
      const b = mates[randInt(mates.length)];
      if (grid[a][d] === grid[b][d]) continue;
      const va = grid[a][d];
      const vb = grid[b][d];
      grid[a][d] = vb;
      grid[b][d] = va;
      undo = () => {
        grid[a][d] = va;
        grid[b][d] = vb;
      };
    } else {
      // Reassign a single cell to a different value
      const s = randInt(nStaff);
      const old = grid[s][d];
      const choices = cellChoices.filter((c) => c !== old);
      if (choices.length === 0) continue;
      const next = choices[randInt(choices.length)];
      grid[s][d] = next;
      undo = () => {
        grid[s][d] = old;
      };
    }

    const cand = evaluate(input, grid);
    // Accept improvements; accept equal-cost moves occasionally to escape plateaus
    if (cand.cost < best.cost || (cand.cost === best.cost && Math.random() < 0.2)) {
      best = cand;
    } else {
      undo();
    }
  }

  return {
    grid,
    evaluation: best,
    iterations,
    elapsedMs: Date.now() - started,
  };
}

function buildRoleMates(input: SolverInput): number[][] {
  return input.staff.map((s, i) =>
    input.staff
      .map((_, j) => j)
      .filter((j) => j !== i && input.staff[j].roleId === s.roleId),
  );
}

function greedyConstruct(input: SolverInput): Grid {
  const { days, staff, coverage, rules, tiers, shiftDefs, startDate } = input;
  const grid: Grid = staff.map(() => Array<CellValue>(days).fill(DAY_OFF));
  const tierById = new Map(tiers.map((t) => [t.id, t]));
  const defByCode = new Map(shiftDefs.map((sd) => [sd.code, sd]));
  const holidayDays = new Set(input.publicHolidayDayIndexes);
  // Spread scarce days (nights, weekends, holidays) using what people already
  // worked in the rolling window, so a fresh roster doesn't undo past balancing.
  // Scaled to this roster's length — see the same note in engine.ts: raw window
  // counts drown out the current period and pile work onto staff with no history.
  const priorByStaff = new Map(input.priorStats.map((p) => [p.staffId, p]));
  const priorScale =
    rules.fairnessWindowDays > 0 ? days / rules.fairnessWindowDays : 0;

  const hardOff = new Set<string>();
  const softOff = new Set<string>();
  for (const o of input.offDays) {
    (o.hard ? hardOff : softOff).add(`${o.staffId}|${o.dayIndex}`);
  }
  // Shifts worked in other wards, so cross-ward rest is respected while building.
  const externalByStaffDay = new Map(
    input.externalShifts.map((e) => [`${e.staffId}|${e.dayIndex}`, e]),
  );

  // Running tallies for balanced picking
  const totalShifts = staff.map(() => 0);
  const totalNights = staff.map(() => 0);

  // Fill the most constrained shifts first: nights, then by display order.
  const shiftOrder = [...shiftDefs].sort((a, b) => {
    if (a.isNightLike !== b.isNightLike) return a.isNightLike ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });

  for (let d = 0; d < days; d++) {
    for (const shiftDef of shiftOrder) {
      const shift = shiftDef.code;
      for (const req of coverage.filter((c) => c.shift === shift)) {
        let needed = req.required;
        if (needed <= 0) continue;

        const candidates = staff
          .map((st, i) => ({ st, i }))
          .filter(({ st, i }) => {
            // Must match what the requirement is asking for
            if (req.roleId && st.roleId !== req.roleId) return false;
            const tier = st.tierId ? tierById.get(st.tierId) : undefined;
            if (req.tierId) {
              if (st.tierId !== req.tierId) return false;
            } else if (!req.roleId && tier && !tier.countsTowardClinicalCoverage) {
              return false; // support staff don't fill a plain headcount floor
            }
            if (grid[i][d] !== DAY_OFF) return false; // already assigned today
            if (hardOff.has(`${st.id}|${d}`)) return false;

            // Tier eligibility for this shift / weekends / public holidays
            if (tier) {
              const rule = tier.shiftRules.find((r) => r.shift === shift);
              if (rule?.eligible === false) return false;
              if (isWeekend(startDate, d) && rule?.weekendEligible === false) return false;
              if (holidayDays.has(d) && rule?.holidayEligible === false) return false;
            }

            // Rest since yesterday's shift — here or in another ward
            if (rules.minRestHours !== null) {
              const prev =
                (d > 0 ? defByCode.get(grid[i][d - 1]) : undefined) ??
                externalByStaffDay.get(`${st.id}|${d - 1}`);
              if (prev && restHoursBetween(prev, shiftDef) < rules.minRestHours) {
                return false;
              }
            }

            if (consecutiveDaysEndingBefore(grid[i], d) >= rules.maxConsecutiveDays)
              return false;

            const maxNights = Math.min(
              rules.maxConsecutiveNights,
              tier?.maxConsecutiveNights ?? Infinity,
            );
            if (shiftDef.isNightLike) {
              if (consecutiveNightsEndingBefore(grid[i], d, defByCode) >= maxNights)
                return false;
              if (nightsInWeek(grid[i], d, defByCode) >= rules.maxNightsPerWeek)
                return false;
            }
            if (daysOffLeftInWeek(grid[i], d, days) <= rules.minDaysOffPerWeek - 1)
              return false;
            return true;
          })
          .sort((a, b) => score(a.i, shiftDef, d) - score(b.i, shiftDef, d));

        for (const { i } of candidates) {
          if (needed <= 0) break;
          grid[i][d] = shift;
          totalShifts[i]++;
          if (shiftDef.isNightLike) totalNights[i]++;
          needed--;
        }
        // If still short here, local search will try to repair it.
      }
    }
  }

  return grid;

  /** Lower = better candidate. */
  function score(i: number, shiftDef: ShiftDef, d: number): number {
    const prior = priorByStaff.get(staff[i].id);
    // Per-FTE load, so part-timers aren't asked for a full-timer's share.
    const fte = Math.max(staff[i].fte, 0.01);
    const was = (n: number | undefined) => (n ?? 0) * priorScale;
    let s = ((totalShifts[i] + was(prior?.total)) / fte) * 2;
    if (shiftDef.isNightLike) {
      s += ((totalNights[i] + was(prior?.nights)) / fte) * 3;
      // Prefer continuing an existing night run (keeps rest patterns sane)
      if (d > 0 && defByCode.get(grid[i][d - 1])?.isNightLike) s -= 4;
    }
    if (isWeekend(startDate, d)) s += (was(prior?.weekends) / fte) * 2;
    if (holidayDays.has(d)) s += (was(prior?.holidays) / fte) * 4;
    if (softOff.has(`${staff[i].id}|${d}`)) s += 25; // avoid requested days off
    return s + Math.random(); // tie-break randomly
  }
}

function consecutiveDaysEndingBefore(row: CellValue[], d: number): number {
  let n = 0;
  for (let i = d - 1; i >= 0 && isWorkShift(row[i]); i--) n++;
  return n;
}

function consecutiveNightsEndingBefore(
  row: CellValue[],
  d: number,
  defByCode: Map<Shift, ShiftDef>,
): number {
  let n = 0;
  for (let i = d - 1; i >= 0 && defByCode.get(row[i])?.isNightLike; i--) n++;
  return n;
}

function nightsInWeek(
  row: CellValue[],
  d: number,
  defByCode: Map<Shift, ShiftDef>,
): number {
  const start = Math.floor(d / 7) * 7;
  let n = 0;
  for (let i = start; i < d; i++) if (defByCode.get(row[i])?.isNightLike) n++;
  return n;
}

/** Days still unassigned (off) in the current 7-day block, excluding today. */
function daysOffLeftInWeek(row: CellValue[], d: number, days: number): number {
  const start = Math.floor(d / 7) * 7;
  const end = Math.min(start + 7, days);
  let n = 0;
  for (let i = start; i < end; i++) {
    if (i === d) continue; // today is about to be assigned
    if (row[i] === DAY_OFF) n++;
  }
  return n;
}

function randInt(n: number): number {
  return Math.floor(Math.random() * n);
}
