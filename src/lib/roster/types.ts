/** The cell value meaning "not working" — the one shift code reserved by the app. */
export const DAY_OFF = "DO";

/**
 * A shift code. Not a fixed union: each ward defines its own vocabulary via
 * ShiftDefinition (Morning/Afternoon/Night, or Day/Call Duty, or clinic
 * sessions). Codes are shared across wards that use the same shift.
 */
export type Shift = string;

/** What a cell in the roster grid holds: a shift code, or DAY_OFF. */
export type CellValue = string;

/** The shift vocabulary of the ward being solved, with the times the rules need. */
export interface ShiftDef {
  code: Shift;
  label: string;
  /** Minutes from midnight. */
  startMinutes: number;
  endMinutes: number;
  crossesMidnight: boolean;
  /** Counts as a night for consecutive-night and night-fairness rules. */
  isNightLike: boolean;
  sortOrder: number;
}

/** Shift codes the legacy 3-shift model used, for seeding/backfill only. */
export const LEGACY_SHIFT_CODES = ["MORNING", "AFTERNOON", "NIGHT"] as const;

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

/** Per-shift eligibility for a tier (weekend flag only applies when eligible). */
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
  /** Tightens the ward's maxConsecutiveNights for this tier when set. */
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

/** How a coverage requirement treats public holidays. */
export type HolidayRule = "SAME" | "EXCLUDE" | "ONLY";

/**
 * Required headcount for one shift, scoped by role and/or tier (both undefined =
 * plain headcount), and optionally by day of week and holidays.
 */
export interface CoverageReq {
  shift: Shift;
  roleId?: string;
  tierId?: string;
  required: number;
  /** 0 = Sunday … 6 = Saturday. Empty = every day. */
  daysOfWeek: number[];
  holidayRule: HolidayRule;
}

export interface Rules {
  maxConsecutiveDays: number;
  maxNightsPerWeek: number;
  minDaysOffPerWeek: number;
  maxConsecutiveNights: number;
  /** Minimum hours between consecutive shifts; null = unenforced. */
  minRestHours: number | null;
  /** Days of published history folded into fairness; 0 = this roster only. */
  fairnessWindowDays: number;
}

/**
 * Rules whose shape doesn't fit a fixed column. The `type` is interpreted by
 * evaluate(); `params` only carries that type's thresholds. Optionally scoped to
 * one tier and/or one shift.
 */
export type RuleType =
  | "BLOCK_PATTERN_ON_OFF"
  | "CHARGE_LEAD_REQUIRED"
  | "MAX_HOURS_PER_WEEK";

export interface WardRule {
  type: RuleType;
  params: Record<string, number | string | boolean>;
  tierId?: string;
  shiftCode?: Shift;
}

/** Who is in charge of a shift: grid position -> designated lead. */
export interface ChargeLead {
  staffId: string;
  dayIndex: number;
  shiftCode: Shift;
}

/**
 * What each person already worked in the rolling window before this roster,
 * counted from published rosters across every ward. Pre-aggregated in the
 * loading layer so evaluate() stays pure arithmetic over plain numbers.
 */
export interface PriorStats {
  staffId: string;
  nights: number;
  weekends: number;
  holidays: number;
  total: number;
}

/** A single day a staff member should (hard) or would like to (soft) be off. */
export interface OffDay {
  staffId: string;
  dayIndex: number;
  hard: boolean;
  reason: "LEAVE" | "REQUEST" | "OTHER_WARD";
  /** For OTHER_WARD, the ward they're committed to. */
  detail?: string;
}

/**
 * A shift a floater works in a *different* ward during (or just before) this
 * period. Pre-resolved so rest checks can span wards without the engine
 * touching the database. dayIndex may be -1: the day before this roster starts
 * still constrains day 0.
 */
export interface ExternalShift {
  staffId: string;
  dayIndex: number;
  startMinutes: number;
  endMinutes: number;
  crossesMidnight: boolean;
  /** That ward's name for the shift, e.g. "Call Duty". */
  shiftLabel: string;
  wardName: string;
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
  /** The ward's shift vocabulary. Empty means nothing can be scheduled. */
  shiftDefs: ShiftDef[];
  /** Shifts these people work in other wards, for cross-ward rest checks. */
  externalShifts: ExternalShift[];
  /** The ward being rostered. */
  homeWardId: string;
  /** Staff in this roster whose home ward is elsewhere (float pool). */
  floatStaffIds: string[];
  /** Day indexes in this period that fall on a public holiday. */
  publicHolidayDayIndexes: number[];
  /** Rolling-window history; empty when fairnessWindowDays is 0. */
  priorStats: PriorStats[];
  /** Rules that carry their own parameters and scope. */
  wardRules: WardRule[];
  /** Who leads each shift, when the ward requires a designated lead. */
  chargeLeads: ChargeLead[];
}

/** grid[staffIndex][dayIndex] — staff order matches input.staff. */
export type Grid = CellValue[][];

export type ViolationType =
  | "COVERAGE_SHORTFALL"
  | "HARD_LEAVE_BROKEN"
  | "INSUFFICIENT_REST"
  | "MAX_CONSECUTIVE_DAYS"
  | "MAX_CONSECUTIVE_NIGHTS"
  | "MAX_NIGHTS_PER_WEEK"
  | "MIN_DAYS_OFF_PER_WEEK"
  | "DO_REQUEST_UNMET"
  | "UNFAIR_SHARE"
  | "TIER_SHIFT_INELIGIBLE"
  | "TIER_PAIRING_UNMET"
  | "COMMITTED_ELSEWHERE"
  | "BLOCK_PATTERN_BROKEN"
  | "MAX_HOURS_PER_WEEK"
  | "CHARGE_LEAD_MISSING"
  | "CHARGE_LEAD_NOT_ELIGIBLE";

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
  /** Who leads each shift, when the ward requires it. */
  chargeLeads: ChargeLead[];
  evaluation: Evaluation;
  iterations: number;
  elapsedMs: number;
}
