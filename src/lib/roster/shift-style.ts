import { DAY_OFF, ShiftDef } from "./types";

/**
 * Palette for roster cells. Shifts are hospital-defined, so colours are assigned
 * by position in the ward's shift list rather than hardcoded per shift name.
 * Night-like shifts always take the dark indigo so they read as nights whatever
 * the hospital calls them.
 */
const PALETTE = [
  "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
  "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/30",
  "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",
  "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/30",
  "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30",
  "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30",
];

const NIGHT_STYLE =
  "bg-indigo-500 text-white border-indigo-600 dark:bg-indigo-500/30 dark:text-indigo-200 dark:border-indigo-500/40";

export const DAY_OFF_STYLE =
  "bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800/50 dark:text-slate-500 dark:border-slate-700/50";

export interface ShiftStyle {
  code: string;
  label: string;
  /** One or two characters for the grid cell. */
  short: string;
  className: string;
}

/** Initials for a shift label, e.g. "Call Duty" → "CD", "Morning" → "M". */
function shortFor(label: string, code: string): string {
  const words = label.trim().split(/[\s_-]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? code).slice(0, 2).toUpperCase().slice(0, label.length > 6 ? 2 : 1);
}

export function buildShiftStyles(shiftDefs: ShiftDef[]): Map<string, ShiftStyle> {
  const map = new Map<string, ShiftStyle>();
  let paletteIdx = 0;
  for (const sd of shiftDefs) {
    map.set(sd.code, {
      code: sd.code,
      label: sd.label,
      short: shortFor(sd.label, sd.code),
      className: sd.isNightLike ? NIGHT_STYLE : PALETTE[paletteIdx++ % PALETTE.length],
    });
  }
  map.set(DAY_OFF, {
    code: DAY_OFF,
    label: "Day off",
    short: "–",
    className: DAY_OFF_STYLE,
  });
  return map;
}

/** Formats minutes-from-midnight as HH:MM. */
export function formatShiftTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
