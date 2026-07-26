"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface WardRow {
  id: string;
  name: string;
  category: string;
  cycleLengthDays: number;
  _count: { staff: number; rosters: number };
}
interface Preset {
  key: string;
  category: string;
  description: string;
  cycleLengthDays: number;
  shifts: { code: string; label: string }[];
}

export default function WardsPage() {
  const [wards, setWards] = useState<WardRow[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [name, setName] = useState("");
  const [preset, setPreset] = useState("standard");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () =>
    Promise.all([api<WardRow[]>("/api/wards"), api<Preset[]>("/api/shift-presets")])
      .then(([w, p]) => {
        setWards(w);
        setPresets(p);
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function createWard(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/wards", { method: "POST", body: JSON.stringify({ name, preset }) });
      setName("");
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const chosen = presets.find((p) => p.key === preset);

  async function deleteWard(id: string, wardName: string) {
    if (!confirm(`Delete ward "${wardName}" and all its staff and rosters?`)) return;
    await api(`/api/wards/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Wards</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Each ward has its own staff, coverage requirements and rules.
        </p>
      </div>

      <form onSubmit={createWard} className="space-y-2">
        <div className="flex flex-wrap gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Paediatrics, ICU, Surgical Ward A"
            className="w-80 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500 shadow-sm"
          />
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm"
          >
            {presets.map((p) => (
              <option key={p.key} value={p.key}>
                {p.category}
              </option>
            ))}
          </select>
          <button className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700 shadow-sm shadow-teal-600/20 transition-all">
            Add ward
          </button>
        </div>
        {chosen && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {chosen.description} — {chosen.shifts.map((s) => s.label).join(", ")} ·{" "}
            {chosen.cycleLengthDays}-day cycle. All editable afterwards.
          </p>
        )}
      </form>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-slate-500 dark:text-slate-400">Loading…</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {wards.map((w) => (
            <div
              key={w.id}
              className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-lg hover:border-teal-200 dark:hover:border-teal-900/50 transition-all"
            >
              <div className="flex items-start justify-between">
                <Link href={`/wards/${w.id}`} className="font-semibold text-lg text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                  {w.name}
                </Link>
                <button
                  onClick={() => deleteWard(w.id, w.name)}
                  className="text-xs font-medium text-slate-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Delete
                </button>
              </div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {w._count.staff} staff · {w._count.rosters} roster{w._count.rosters === 1 ? "" : "s"}
              </p>
              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                {w.category} · {w.cycleLengthDays}-day cycle
              </p>
              <Link
                href={`/wards/${w.id}`}
                className="mt-4 inline-block rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-900/30 dark:hover:text-teal-300 transition-colors"
              >
                Configure <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
