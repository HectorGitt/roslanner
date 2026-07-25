import { evaluate, isWeekend, isWorkShift } from "./engine";
import {
  CellValue,
  Grid,
  Shift,
  SHIFTS,
  SolveResult,
  SolverInput,
} from "./types";

const TIME_BUDGET_MS = 2000;
const MAX_ITERATIONS = 60_000;

/**
 * Two-phase heuristic solver:
 *  1. Greedy day-by-day construction that fills coverage while respecting
 *     hard rest rules and leave.
 *  2. Local search (hill climbing with occasional sideways moves) over
 *     swap / reassign moves, scored by the shared evaluate() function.
 */
export function solve(input: SolverInput): SolveResult {
  const started = Date.now();
  const grid = greedyConstruct(input);

  let best = evaluate(input, grid);
  let iterations = 0;
  const nStaff = input.staff.length;
  const roleMates = buildRoleMates(input);

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
      const choices = CELL_CHOICES.filter((c) => c !== old);
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

const CELL_CHOICES: CellValue[] = ["MORNING", "AFTERNOON", "NIGHT", "DO"];

function buildRoleMates(input: SolverInput): number[][] {
  return input.staff.map((s, i) =>
    input.staff
      .map((_, j) => j)
      .filter((j) => j !== i && input.staff[j].roleId === s.roleId),
  );
}

function greedyConstruct(input: SolverInput): Grid {
  const { days, staff, coverage, rules, tiers, startDate } = input;
  const grid: Grid = staff.map(() => Array<CellValue>(days).fill("DO"));
  const tierById = new Map(tiers.map((t) => [t.id, t]));

  const hardOff = new Set<string>();
  const softOff = new Set<string>();
  for (const o of input.offDays) {
    (o.hard ? hardOff : softOff).add(`${o.staffId}|${o.dayIndex}`);
  }

  // Running tallies for balanced picking
  const totalShifts = staff.map(() => 0);
  const totalNights = staff.map(() => 0);

  // Fill nights first (most constrained), then mornings, then afternoons.
  const shiftOrder: Shift[] = ["NIGHT", "MORNING", "AFTERNOON"];

  for (let d = 0; d < days; d++) {
    for (const shift of shiftOrder) {
      for (const req of coverage.filter((c) => c.shift === shift)) {
        let needed = req.required;
        if (needed <= 0) continue;

        const candidates = staff
          .map((st, i) => ({ st, i }))
          .filter(({ st, i }) => {
            if (st.roleId !== req.roleId) return false;
            if (grid[i][d] !== "DO") return false; // already assigned today
            if (hardOff.has(`${st.id}|${d}`)) return false;
            if (
              rules.noMorningAfterNight &&
              shift === "MORNING" &&
              d > 0 &&
              grid[i][d - 1] === "NIGHT"
            )
              return false;
            if (consecutiveDaysEndingBefore(grid[i], d) >= rules.maxConsecutiveDays)
              return false;
            const tier = st.tierId ? tierById.get(st.tierId) : undefined;
            if (tier) {
              const shiftRule = tier.shiftRules.find((r) => r.shift === shift);
              if (shiftRule?.eligible === false) return false;
              if (isWeekend(startDate, d) && shiftRule?.weekendEligible === false) return false;
            }
            const maxNights = tier?.maxConsecutiveNights ?? rules.maxConsecutiveNights;
            if (
              shift === "NIGHT" &&
              consecutiveNightsEndingBefore(grid[i], d) >= maxNights
            )
              return false;
            if (shift === "NIGHT" && nightsInWeek(grid[i], d) >= rules.maxNightsPerWeek)
              return false;
            if (daysOffLeftInWeek(grid[i], d, days) <= rules.minDaysOffPerWeek - 1)
              return false;
            return true;
          })
          .sort((a, b) => score(a.i, shift, d) - score(b.i, shift, d));

        for (const { i } of candidates) {
          if (needed <= 0) break;
          grid[i][d] = shift;
          totalShifts[i]++;
          if (shift === "NIGHT") totalNights[i]++;
          needed--;
        }
        // If still short here, local search will try to repair it.
      }
    }
  }

  return grid;

  /** Lower = better candidate. */
  function score(i: number, shift: Shift, d: number): number {
    let s = totalShifts[i] * 2;
    if (shift === "NIGHT") {
      s += totalNights[i] * 3;
      // Prefer continuing an existing night run (keeps rest patterns sane)
      if (d > 0 && grid[i][d - 1] === "NIGHT") s -= 4;
    }
    if (softOff.has(`${staff[i].id}|${d}`)) s += 25; // avoid requested days off
    return s + Math.random(); // tie-break randomly
  }
}

function consecutiveDaysEndingBefore(row: CellValue[], d: number): number {
  let n = 0;
  for (let i = d - 1; i >= 0 && isWorkShift(row[i]); i--) n++;
  return n;
}

function consecutiveNightsEndingBefore(row: CellValue[], d: number): number {
  let n = 0;
  for (let i = d - 1; i >= 0 && row[i] === "NIGHT"; i--) n++;
  return n;
}

function nightsInWeek(row: CellValue[], d: number): number {
  const start = Math.floor(d / 7) * 7;
  let n = 0;
  for (let i = start; i < d; i++) if (row[i] === "NIGHT") n++;
  return n;
}

/** Days still unassigned (DO) in the current 7-day block, including today. */
function daysOffLeftInWeek(row: CellValue[], d: number, days: number): number {
  const start = Math.floor(d / 7) * 7;
  const end = Math.min(start + 7, days);
  let n = 0;
  for (let i = start; i < end; i++) {
    if (i === d) continue; // today is about to be assigned
    if (row[i] === "DO") n++;
  }
  return n;
}

function randInt(n: number): number {
  return Math.floor(Math.random() * n);
}

export { SHIFTS };
