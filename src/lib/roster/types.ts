export const SHIFTS = ["MORNING", "AFTERNOON", "NIGHT"] as const;
export type Shift = (typeof SHIFTS)[number];

/** What a cell in the roster grid can hold. DO = day off. */
export const CELL_VALUES = ["MORNING", "AFTERNOON", "NIGHT", "DO"] as const;
export type CellValue = (typeof CELL_VALUES)[number];

export interface SolverStaff {
  id: string;
  name: string;
  roleId: string;
  roleName: string;
  tierId?: string;
  tierName?: string;
  fte: number;
  canBeLead: boolean;
}

/** Per-shift eligibility for a tier (weekend/holiday flags only apply when eligible=true). */
export interface TierShiftRule {
  shift: Shift;
  eligible: boolean;
  weekendEligible: boolean;
  holidayEligible: boolean;
}

export interface TierInfo {
  id: string;
  name: string;
  countsTowardClinicalCoverage: boolean;
  /** Overrides the ward's Rules.maxConsecutiveNights for staff in this tier, if set. */
  maxConsecutiveNights: number | null;
  shiftRules: TierShiftRule[];
}

/** "Whenever a dependentTier staffer works a shift, at least minRequiredCount of requiredTier must also be on it." */
export interface TierPairing {
  dependentTierId: string;
  requiredTierId: string;
  minRequiredCount: number;
  /** undefined = applies to every shift. */
  shift?: Shift;
}

export interface CoverageReq {
  shift: Shift;
  roleId: string;
  required: number;
}

export interface Rules {
  maxConsecutiveDays: number;
  maxNightsPerWeek: number;
  minDaysOffPerWeek: number;
  noMorningAfterNight: boolean;
  maxConsecutiveNights: number;
}

/** A single day a staff member should (hard) or would like to (soft) be off. */
export interface OffDay {
  staffId: string;
  dayIndex: number;
  hard: boolean;
}

export interface SolverInput {
  days: number;
  /** ISO date (yyyy-mm-dd) of day 0 — used for weekend fairness. */
  startDate: string;
  staff: SolverStaff[];
  coverage: CoverageReq[];
  rules: Rules;
  offDays: OffDay[];
  tiers: TierInfo[];
  tierPairings: TierPairing[];
}

/** grid[staffIndex][dayIndex] — staff order matches input.staff. */
export type Grid = CellValue[][];

export type ViolationType =
  | "COVERAGE_SHORTFALL"
  | "HARD_LEAVE_BROKEN"
  | "MORNING_AFTER_NIGHT"
  | "MAX_CONSECUTIVE_DAYS"
  | "MAX_CONSECUTIVE_NIGHTS"
  | "MAX_NIGHTS_PER_WEEK"
  | "MIN_DAYS_OFF_PER_WEEK"
  | "DO_REQUEST_UNMET"
  | "UNFAIR_SHARE"
  | "TIER_SHIFT_INELIGIBLE"
  | "TIER_PAIRING_UNMET";

export interface Violation {
  type: ViolationType;
  severity: "HARD" | "SOFT";
  message: string;
  /** Staff involved, if staff-specific. */
  staffId?: string;
  /** Days involved (for highlighting cells). */
  dayIndexes: number[];
}

export interface Evaluation {
  hardCount: number;
  softCount: number;
  /** Fairness spread — lower is fairer. */
  fairnessCost: number;
  cost: number;
  violations: Violation[];
}

export interface SolveResult {
  grid: Grid;
  evaluation: Evaluation;
  iterations: number;
  elapsedMs: number;
}
