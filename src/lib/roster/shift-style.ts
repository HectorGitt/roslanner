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
  "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30",
  "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30",
  "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30",
];

const NIGHT_STYLE =
  "bg-indigo-500 text-white border-indigo-600 dark:bg-indigo-500/30 dark:text-indigo-200 dark:border-indigo-500/40";

export const DAY_OFF_STYLE =
  "bg-zinc-100 text-zinc-400 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-500 dark:border-zinc-700/50";

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
