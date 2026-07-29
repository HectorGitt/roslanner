"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface WardRow {
  id: string;
  name: string;
  category: string;
  cycleLengthDays: number;
}
interface RosterRow {
  id: string;
  startDate: string;
  days: number;
  status: string;
  ward: { name: string };
  group: { id: string; name: string } | null;
  createdAt: string;
}
interface GroupRow {
  id: string;
  name: string;
  roles: { id: string; name: string }[];
}

export default function RostersPage() {
  const router = useRouter();
  const [wards, setWards] = useState<WardRow[]>([]);
  const [rosters, setRosters] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [wardId, setWardId] = useState("");
  // "" = the whole ward, which is what a roster covers when no groups exist.
  const [groupId, setGroupId] = useState("");
  const [startDate, setStartDate] = useState("");
  // Follows the chosen ward's own cycle length until the planner overrides it.
  const [days, setDays] = useState(7);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    Promise.all([
      api<WardRow[]>("/api/wards"),
      api<RosterRow[]>("/api/rosters"),
      api<GroupRow[]>("/api/groups"),
    ])
      .then(([w, r, g]) => {
        setWards(w);
        setRosters(r);
        setGroups(g);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function generate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setGenerating(true);
    try {
      const res = await api<{ rosterId: string }>("/api/rosters", {
        method: "POST",
        body: JSON.stringify({ wardId, groupId: groupId || null, startDate, days }),
      });
      router.push(`/rosters/${res.rosterId}`);
    } catch (err) {
      setError((err as Error).message);
      setGenerating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this roster?")) return;
    await api(`/api/rosters/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Rosters</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Generate a roster for a ward — the solver fills coverage while respecting rest
          rules, leave and fairness.
        </p>
      </div>

      <form
        onSubmit={generate}
        className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
      >
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">Ward</span>
          <select
            required
            value={wardId}
            onChange={(e) => {
              setWardId(e.target.value);
              // Adopt the ward's own cycle length as the starting period.
              const w = wards.find((x) => x.id === e.target.value);
              if (w) setDays(w.cycleLengthDays);
            }}
            className="w-52 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-slate-900 dark:text-white outline-none focus:border-teal-500 shadow-sm"
          >
            <option value="">Select…</option>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        {groups.length > 0 && (
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">
              Covers
            </span>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-44 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-slate-900 dark:text-white outline-none focus:border-teal-500 shadow-sm"
            >
              <option value="">Everyone on the ward</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">Start date</span>
          <input
            required
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-slate-900 dark:text-white outline-none focus:border-teal-500 shadow-sm [color-scheme:light] dark:[color-scheme:dark]"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">Days</span>
          <input
            type="number"
            min={1}
            max={62}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-24 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-slate-900 dark:text-white outline-none focus:border-teal-500 shadow-sm"
          />
        </label>
        <button
          disabled={generating}
          className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 shadow-sm shadow-teal-600/20 transition-all flex items-center gap-2"
        >
          {generating ? (
            <>
              <svg className="animate-spin -ml-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Solving…
            </>
          ) : "Generate roster"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        {rosters.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No rosters yet.</p>
        )}
        {rosters.map((r) => (
          <div
            key={r.id}
            className="group flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 px-5 py-4 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <Link href={`/rosters/${r.id}`} className="flex-1 hover:text-teal-700 dark:hover:text-teal-400 transition-colors">
              <span className="font-semibold text-slate-900 dark:text-white">{r.ward.name}</span>
              {r.group && (
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {r.group.name}
                </span>
              )}
              <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">
                {/* Calendar dates are stored as UTC midnight; render them as such
                    or they show a day early west of UTC. */}
                {new Date(r.startDate).toLocaleDateString(undefined, { timeZone: "UTC" })}{" "}
                <span className="mx-1">&middot;</span> {r.days} days
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${
                  r.status === "PUBLISHED"
                    ? "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                    : "bg-amber-100/80 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                }`}
              >
                {r.status}
              </span>
              <button
                onClick={() => remove(r.id)}
                className="text-xs font-medium text-slate-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
