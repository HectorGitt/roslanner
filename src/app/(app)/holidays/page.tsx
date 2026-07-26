"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Holiday {
  id: string;
  date: string;
  name: string;
  groupKey: string;
}

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const load = () =>
    api<Holiday[]>("/api/holidays")
      .then(setHolidays)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/holidays", { method: "POST", body: JSON.stringify({ date, name }) });
      setDate("");
      setName("");
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(id: string) {
    await api(`/api/holidays/${id}`, { method: "DELETE" });
    load();
  }

  // Group recurring instances so it's obvious which years are recorded.
  const byGroup = new Map<string, Holiday[]>();
  for (const h of holidays) {
    byGroup.set(h.groupKey, [...(byGroup.get(h.groupKey) ?? []), h]);
  }

  if (loading) return <p className="text-slate-500 dark:text-slate-400">Loading…</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Public holidays</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Holidays are treated separately from ordinary days: tiers can be kept off them
          entirely, and working them is balanced across staff over time rather than within
          a single roster. Add each year&apos;s date — instances sharing a name are linked,
          so &quot;who worked it last year&quot; is answerable.
        </p>
      </div>

      <form
        onSubmit={add}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm"
      >
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-900 dark:text-white">Date</span>
          <input
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500 [color-scheme:light] dark:[color-scheme:dark]"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-900 dark:text-white">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Christmas Day"
            className="w-56 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500"
          />
        </label>
        <button className="rounded-xl bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700 shadow-sm shadow-teal-600/20">
          Add holiday
        </button>
      </form>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        {holidays.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No public holidays recorded.
          </p>
        )}
        {holidays.map((h) => (
          <div
            key={h.id}
            className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 px-5 py-3 last:border-0 text-sm"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium text-slate-900 dark:text-white">
                {new Date(h.date).toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span className="text-slate-600 dark:text-slate-400">{h.name}</span>
              {(byGroup.get(h.groupKey)?.length ?? 0) > 1 && (
                <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {byGroup.get(h.groupKey)!.length} years recorded
                </span>
              )}
            </div>
            <button
              onClick={() => remove(h.id)}
              className="text-xs text-slate-400 hover:text-red-600 dark:hover:text-red-400"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
