"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { evaluate, isWeekend } from "@/lib/roster/engine";
import {
  buildShiftStyles,
  DAY_OFF_STYLE,
  formatShiftTime,
  type ShiftStyle,
} from "@/lib/roster/shift-style";
import { DAY_OFF } from "@/lib/roster/types";
import type {
  CellValue,
  Evaluation,
  Grid,
  OffDay,
  SolverInput,
  SolverStaff,
} from "@/lib/roster/types";

interface RosterPayload {
  id: string;
  ward: { id: string; name: string };
  startDate: string;
  days: number;
  status: string;
  staff: SolverStaff[];
  offDays: OffDay[];
  coverage: SolverInput["coverage"];
  rules: SolverInput["rules"];
  tiers: SolverInput["tiers"];
  tierPairings: SolverInput["tierPairings"];
  shiftDefs: SolverInput["shiftDefs"];
  externalShifts: SolverInput["externalShifts"];
  homeWardId: string;
  /** Staff on this roster whose home ward is elsewhere. */
  floatStaffIds: string[];
  publicHolidayDayIndexes: number[];
  priorStats: SolverInput["priorStats"];
  grid: Grid;
  evaluation: Evaluation;
}

export default function RosterPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<RosterPayload | null>(null);
  const [grid, setGrid] = useState<Grid>([]);
  const [dirty, setDirty] = useState<Map<string, CellValue>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<RosterPayload>(`/api/rosters/${id}`)
      .then((d) => {
        setData(d);
        setGrid(d.grid.map((row) => [...row]));
      })
      .catch((e) => setError(e.message));
  }, [id]);

  // Live evaluation — same engine the solver uses, run in the browser on every edit
  const evaluation: Evaluation | null = useMemo(() => {
    if (!data || grid.length === 0) return null;
    const input: SolverInput = {
      days: data.days,
      startDate: data.startDate,
      staff: data.staff,
      coverage: data.coverage,
      rules: data.rules,
      offDays: data.offDays,
      tiers: data.tiers,
      tierPairings: data.tierPairings,
      shiftDefs: data.shiftDefs,
      externalShifts: data.externalShifts,
      homeWardId: data.homeWardId,
      floatStaffIds: data.floatStaffIds,
      publicHolidayDayIndexes: data.publicHolidayDayIndexes,
      priorStats: data.priorStats,
    };
    return evaluate(input, grid);
  }, [data, grid]);

  // Cell colours/labels come from the ward's own shift definitions.
  const shiftStyles = useMemo(
    () => buildShiftStyles(data?.shiftDefs ?? []),
    [data?.shiftDefs],
  );
  // Clicking a cell walks the ward's shifts in order, then a day off.
  const cycle = useMemo<CellValue[]>(
    () => [...(data?.shiftDefs ?? []).map((sd) => sd.code), DAY_OFF],
    [data?.shiftDefs],
  );

  // Cells involved in hard violations → red ring
  const badCells = useMemo(() => {
    const set = new Set<string>();
    if (!evaluation) return set;
    for (const v of evaluation.violations) {
      if (v.severity !== "HARD" || !v.staffId) continue;
      for (const d of v.dayIndexes) set.add(`${v.staffId}|${d}`);
    }
    return set;
  }, [evaluation]);

  // Days with coverage shortfalls → flagged in the header
  const shortDays = useMemo(() => {
    const set = new Set<number>();
    if (!evaluation) return set;
    for (const v of evaluation.violations) {
      if (v.type === "COVERAGE_SHORTFALL") v.dayIndexes.forEach((d) => set.add(d));
    }
    return set;
  }, [evaluation]);

  const offMap = useMemo(() => {
    const m = new Map<string, "hard" | "soft">();
    for (const o of data?.offDays ?? []) {
      m.set(`${o.staffId}|${o.dayIndex}`, o.hard ? "hard" : "soft");
    }
    return m;
  }, [data]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data || !evaluation) return <p className="text-slate-500">Loading…</p>;

  function cycleCell(sIdx: number, d: number) {
    if (cycle.length === 0) return;
    const current = grid[sIdx][d];
    const at = cycle.indexOf(current);
    // An unknown code (a shift removed since this roster was made) steps to the first shift.
    const next = cycle[(at + 1) % cycle.length];
    setGrid((g) => {
      const copy = g.map((row) => [...row]);
      copy[sIdx][d] = next;
      return copy;
    });
    setDirty((m) => {
      const copy = new Map(m);
      copy.set(`${data!.staff[sIdx].id}|${d}`, next);
      return copy;
    });
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const edits = [...dirty.entries()].map(([key, shift]) => {
        const [staffId, dayIndex] = key.split("|");
        return { staffId, dayIndex: Number(dayIndex), shift };
      });
      const fresh = await api<RosterPayload>(`/api/rosters/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ edits }),
      });
      setData(fresh);
      setGrid(fresh.grid.map((row) => [...row]));
      setDirty(new Map());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function reoptimize() {
    if (!confirm("This will overwrite all manual changes with a fresh AI-generated schedule. Continue?")) return;
    setSaving(true);
    setError("");
    try {
      const fresh = await api<RosterPayload>(`/api/rosters/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ reoptimize: true }),
      });
      setData(fresh);
      setGrid(fresh.grid.map((row) => [...row]));
      setDirty(new Map());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status: string) {
    const fresh = await api<RosterPayload>(`/api/rosters/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setData(fresh);
  }

  const holidayDays = new Set(data.publicHolidayDayIndexes);
  const dayHeaders = Array.from({ length: data.days }, (_, d) => {
    const date = new Date(data.startDate + "T00:00:00");
    date.setDate(date.getDate() + d);
    return {
      d,
      weekend: isWeekend(data.startDate, d),
      holiday: holidayDays.has(d),
      dow: date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2),
      num: date.getDate(),
    };
  });

  // Group staff rows by role for section headers
  const groups: { roleName: string; rows: { staff: SolverStaff; idx: number }[] }[] = [];
  data.staff.forEach((st, idx) => {
    const last = groups[groups.length - 1];
    if (last && last.roleName === st.roleName) last.rows.push({ staff: st, idx });
    else groups.push({ roleName: st.roleName, rows: [{ staff: st, idx }] });
  });

  const hard = evaluation.violations.filter((v) => v.severity === "HARD");
  const soft = evaluation.violations.filter((v) => v.severity === "SOFT");

  /** Per-shift counts for one staff row, in the ward's shift order. */
  function shiftTally(row: CellValue[]): number[] {
    return data!.shiftDefs.map((sd) => row.filter((v) => v === sd.code).length);
  }
  const tallyHeader = data.shiftDefs.map((sd) => shiftStyles.get(sd.code)?.short ?? sd.code).join("/");

  function exportCsv() {
    if (!data) return;
    const headers = ["Staff", ...dayHeaders.map((h) => `${h.dow} ${h.num}`), tallyHeader];
    const rows = [headers.join(",")];
    groups.forEach(g => {
      rows.push(`"${g.roleName}",${Array(data.days + 1).fill("").join(",")}`);
      g.rows.forEach(({ staff, idx }) => {
        const row = grid[idx];
        const rowData = [
          `"${staff.name}"`,
          ...row.map((v) => (v === DAY_OFF ? "OFF" : v)),
          `"${shiftTally(row).join("/")}"`,
        ];
        rows.push(rowData.join(","));
      });
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${data.ward.name.replace(/\s+/g, "_")}_Roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/rosters" className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors print:hidden">
            &larr; All rosters
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {data.ward.name}{" "}
            <span className="font-normal text-slate-500 dark:text-slate-400">
              &middot; {new Date(data.startDate + "T00:00:00").toLocaleDateString()} &middot; {data.days}{" "}
              days &middot; {grid.reduce((acc, row) => acc + row.filter(v => v !== "DO").length, 0)} shifts
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
            title="Print roster"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            <span className="hidden sm:inline">Print</span>
          </button>
          <button
            onClick={exportCsv}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
            title="Export as CSV"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            <span className="hidden sm:inline">Export</span>
          </button>
          {data.status === "DRAFT" && dirty.size === 0 && (
            <button
              onClick={reoptimize}
              disabled={saving}
              className="rounded-xl border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/20 px-4 py-2 text-sm font-medium text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/40 disabled:opacity-50 transition-colors flex items-center gap-2"
              title="Re-run AI solver"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              <span className="hidden sm:inline">Re-optimize</span>
            </button>
          )}
          {dirty.size > 0 && (
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : `Save ${dirty.size} change${dirty.size === 1 ? "" : "s"}`}
            </button>
          )}
          {data.status === "DRAFT" ? (
            <button
              onClick={() => setStatus("PUBLISHED")}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
            >
              Publish
            </button>
          ) : (
            <button
              onClick={() => setStatus("DRAFT")}
              className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
            >
              Unpublish
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 print:hidden">{error}</p>}

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400 print:hidden">
        {data.shiftDefs.map((sd) => {
          const style = shiftStyles.get(sd.code)!;
          return (
            <span key={sd.code} className="flex items-center gap-1.5">
              <i className={`inline-block h-4 w-4 rounded border ${style.className}`} />
              {sd.label}
              <span className="text-slate-400 dark:text-slate-600">
                {formatShiftTime(sd.startMinutes)}–{formatShiftTime(sd.endMinutes)}
              </span>
            </span>
          );
        })}
        <span className="flex items-center gap-1.5">
          <i className={`inline-block h-4 w-4 rounded border ${DAY_OFF_STYLE}`} />
          Day off
        </span>
        <span className="text-slate-400 dark:text-slate-600">·</span>
        <span>
          Click a cell to cycle{" "}
          {[...data.shiftDefs.map((sd) => sd.label), "off"].join(" → ")}
        </span>
        <span className="text-slate-400 dark:text-slate-600">·</span>
        <span>
          <b className="text-rose-600 dark:text-rose-400">L</b> leave &nbsp;
          <b className="text-sky-600 dark:text-sky-400">R</b> day-off request
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="border-separate border-spacing-0 text-xs w-full">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-left font-medium text-slate-900 dark:text-white">
                Staff
              </th>
              {dayHeaders.map((h) => (
                <th
                  key={h.d}
                  title={h.holiday ? "Public holiday" : undefined}
                  className={`border-b border-slate-200 dark:border-slate-800 px-1 py-2 text-center font-medium ${
                    h.holiday
                      ? "bg-amber-50 dark:bg-amber-500/10"
                      : h.weekend
                        ? "bg-slate-100 dark:bg-slate-800/50"
                        : "bg-white dark:bg-slate-900"
                  } ${shortDays.has(h.d) ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-400"}`}
                >
                  <div>{h.dow}</div>
                  <div className="text-sm">{h.num}</div>
                  {h.holiday && (
                    <div className="text-[9px] font-semibold uppercase text-amber-600 dark:text-amber-400">
                      hol
                    </div>
                  )}
                  {shortDays.has(h.d) && <div title="Coverage shortfall">⚠</div>}
                </th>
              ))}
              <th
                className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-2 text-center font-medium text-slate-500 dark:text-slate-400"
                title={data.shiftDefs.map((sd) => sd.label).join(" / ")}
              >
                {tallyHeader}
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <GroupRows
                key={g.roleName}
                group={g}
                days={data.days}
                grid={grid}
                dayHeaders={dayHeaders}
                badCells={badCells}
                offMap={offMap}
                onCycle={cycleCell}
                shiftStyles={shiftStyles}
                tally={shiftTally}
                floatStaffIds={new Set(data.floatStaffIds)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            Hard violations
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs ${
                hard.length === 0
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
              }`}
            >
              {hard.length}
            </span>
          </h2>
          {hard.length === 0 ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">All hard constraints satisfied ✓</p>
          ) : (
            <ul className="max-h-56 space-y-1.5 overflow-y-auto text-sm text-slate-700 dark:text-slate-300">
              {hard.map((v, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-rose-500 dark:text-rose-400">•</span>
                  {v.message}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            Warnings & fairness
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs text-slate-600 dark:text-slate-400">
              {soft.length}
            </span>
          </h2>
          {soft.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No warnings or unfair distributions.</p>
          ) : (
            <ul className="max-h-56 space-y-1.5 overflow-y-auto text-sm text-slate-700 dark:text-slate-300">
              {soft.map((v, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-sky-500 dark:text-sky-400">•</span>
                  {v.message}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 border-t border-slate-100 dark:border-slate-800/50 pt-3 space-y-1.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Fairness spread (lower is more even): <span className="font-medium text-slate-900 dark:text-white">{evaluation.fairnessCost.toFixed(1)}</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Total evaluation cost (lower is better): <span className="font-medium text-slate-900 dark:text-white">{evaluation.cost.toFixed(1)}</span>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function GroupRows({
  group,
  days,
  grid,
  dayHeaders,
  badCells,
  offMap,
  onCycle,
  shiftStyles,
  tally,
  floatStaffIds,
}: {
  group: { roleName: string; rows: { staff: SolverStaff; idx: number }[] };
  days: number;
  grid: Grid;
  dayHeaders: { d: number; weekend: boolean; holiday: boolean }[];
  badCells: Set<string>;
  offMap: Map<string, "hard" | "soft">;
  onCycle: (sIdx: number, d: number) => void;
  shiftStyles: Map<string, ShiftStyle>;
  tally: (row: CellValue[]) => number[];
  floatStaffIds: Set<string>;
}) {
  // A cell can hold a shift removed from the ward since the roster was made.
  const styleFor = (v: CellValue): ShiftStyle =>
    shiftStyles.get(v) ?? {
      code: v,
      label: `${v} (removed)`,
      short: "?",
      className:
        "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40",
    };
  return (
    <>
      <tr>
        <td
          colSpan={days + 2}
          className="sticky left-0 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
        >
          {group.roleName}
        </td>
      </tr>
      {group.rows.map(({ staff, idx }) => {
        const row = grid[idx];
        return (
          <tr key={staff.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
            <td className="sticky left-0 z-10 max-w-40 truncate border-b border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-900 px-3 py-1.5 font-medium text-slate-900 dark:text-white">
              {staff.name}
              {floatStaffIds.has(staff.id) && (
                <span
                  title="Based in another ward — floated in"
                  className="ml-1.5 rounded bg-violet-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
                >
                  float
                </span>
              )}
            </td>
            {row.map((v, d) => {
              const off = offMap.get(`${staff.id}|${d}`);
              const bad = badCells.has(`${staff.id}|${d}`);
              const style = styleFor(v);
              return (
                <td
                  key={d}
                  className={`border-b border-slate-100 dark:border-slate-800/50 p-0.5 ${
                    dayHeaders[d].weekend ? "bg-slate-50 dark:bg-slate-800/20" : ""
                  }`}
                >
                  <button
                    onClick={() => onCycle(idx, d)}
                    title={`${staff.name} — day ${d + 1}: ${style.label}${
                      off === "hard" ? " (on leave)" : off === "soft" ? " (requested off)" : ""
                    }`}
                    className={`relative flex h-8 w-8 items-center justify-center rounded border text-[11px] font-semibold transition ${style.className} ${
                      bad ? "ring-2 ring-rose-500" : "hover:scale-105"
                    }`}
                  >
                    {style.short}
                    {off && (
                      <span
                        className={`absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold text-white ${
                          off === "hard" ? "bg-rose-500" : "bg-sky-500"
                        }`}
                      >
                        {off === "hard" ? "L" : "R"}
                      </span>
                    )}
                  </button>
                </td>
              );
            })}
            <td className="border-b border-slate-100 dark:border-slate-800/50 px-2 text-center text-slate-500 dark:text-slate-400">
              {tally(row).join("/")}
            </td>
          </tr>
        );
      })}
    </>
  );
}
