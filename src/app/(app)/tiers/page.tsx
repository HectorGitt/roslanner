"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface TierRow {
  id: string;
  name: string;
  rank: number;
  countsTowardClinicalCoverage: boolean;
  maxConsecutiveNights: number | null;
  _count: { staff: number };
}
interface PairingRow {
  id: string;
  minRequiredCount: number;
  dependentTier: { id: string; name: string };
  requiredTier: { id: string; name: string };
}
interface ShiftOption {
  code: string;
  label: string;
  isNightLike: boolean;
}
interface EligibilityRow {
  tierId: string;
  shiftCode: string;
  eligible: boolean;
  weekendEligible: boolean;
  holidayEligible: boolean;
}

export default function TiersPage() {
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [pairings, setPairings] = useState<PairingRow[]>([]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [eligibility, setEligibility] = useState<EligibilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [name, setName] = useState("");
  const [rank, setRank] = useState(0);
  const [countsTowardClinicalCoverage, setCounts] = useState(true);
  const [maxNights, setMaxNights] = useState("");

  const [dependentTierId, setDependentTierId] = useState("");
  const [requiredTierId, setRequiredTierId] = useState("");
  const [minRequiredCount, setMinRequiredCount] = useState(1);

  const load = () =>
    Promise.all([
      api<TierRow[]>("/api/tiers"),
      api<PairingRow[]>("/api/tier-pairings"),
      api<{ items: EligibilityRow[]; shifts: ShiftOption[] }>("/api/tier-eligibility"),
    ])
      .then(([t, p, e]) => {
        setTiers(t);
        setPairings(p);
        setEligibility(e.items);
        setShifts(e.shifts);
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function addTier(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/tiers", {
        method: "POST",
        body: JSON.stringify({
          name,
          rank,
          countsTowardClinicalCoverage,
          maxConsecutiveNights: maxNights === "" ? null : Number(maxNights),
        }),
      });
      setName("");
      setRank(0);
      setCounts(true);
      setMaxNights("");
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function deleteTier(id: string) {
    if (!confirm("Delete this tier? Staff assigned to it will become tier-less.")) return;
    await api(`/api/tiers/${id}`, { method: "DELETE" });
    load();
  }

  async function addPairing(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/tier-pairings", {
        method: "POST",
        body: JSON.stringify({ dependentTierId, requiredTierId, minRequiredCount }),
      });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function deletePairing(id: string) {
    await api(`/api/tier-pairings/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <p className="text-slate-500 dark:text-slate-400">Loading…</p>;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Staff tiers</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Your own staff hierarchy — e.g. Senior Executive, Core Clinical, Rotational, Support.
          Shift eligibility and pairing rules below apply across every ward that uses
          the shift, so you only set them once.
        </p>
      </div>

      <form
        onSubmit={addTier}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm"
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-900 dark:text-white">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Nurse Intern"
            className="w-52 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-900 dark:text-white">Rank</span>
          <input
            type="number"
            value={rank}
            onChange={(e) => setRank(Number(e.target.value))}
            className="w-20 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-900 dark:text-white">Max consecutive nights</span>
          <input
            type="number"
            min={0}
            value={maxNights}
            onChange={(e) => setMaxNights(e.target.value)}
            placeholder="ward default"
            className="w-32 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500"
          />
        </label>
        <label className="flex items-center gap-2 pb-2.5 text-sm">
          <input
            type="checkbox"
            checked={countsTowardClinicalCoverage}
            onChange={(e) => setCounts(e.target.checked)}
            className="h-4 w-4 accent-teal-600"
          />
          <span
            className="font-medium text-slate-900 dark:text-white"
            title="Uncheck for support staff (porters, attendants). Applies to tier-scoped coverage rules; role-based coverage is already role-specific."
          >
            Counts toward clinical coverage
          </span>
        </label>
        <button className="rounded-xl bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700 shadow-sm shadow-teal-600/20">
          Add tier
        </button>
      </form>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        {tiers.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No tiers yet.</p>
        )}
        {tiers.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 px-5 py-4 last:border-0"
          >
            <div>
              <span className="font-medium text-slate-900 dark:text-white">{t.name}</span>
              <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                rank {t.rank} · {t._count.staff} staff
                {!t.countsTowardClinicalCoverage && " · non-clinical"}
                {t.maxConsecutiveNights !== null && ` · max ${t.maxConsecutiveNights} consecutive nights`}
              </span>
            </div>
            <button
              onClick={() => deleteTier(t.id)}
              className="text-xs text-slate-400 hover:text-red-600 dark:hover:text-red-400"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {tiers.length > 0 && shifts.length > 0 && (
        <EligibilityMatrix
          tiers={tiers}
          shifts={shifts}
          eligibility={eligibility}
          onSaved={() => {
            setNotice("Shift eligibility saved.");
            setTimeout(() => setNotice(""), 2500);
            load();
          }}
        />
      )}
      {notice && <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>}

      <div>
        <h2 className="mb-1 text-lg font-semibold text-slate-900 dark:text-white">Pairing rules</h2>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          E.g. &quot;whenever a Nurse Intern is on shift, at least 1 Core Clinical staffer must also be
          on it&quot; — applies to every shift, in every ward.
        </p>
        {tiers.length < 2 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Add at least two tiers to create a pairing rule.</p>
        ) : (
          <form onSubmit={addPairing} className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-900 dark:text-white">When this tier works…</span>
              <select
                required
                value={dependentTierId}
                onChange={(e) => setDependentTierId(e.target.value)}
                className="w-48 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                <option value="">Select…</option>
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-900 dark:text-white">…require at least</span>
              <input
                type="number"
                min={1}
                value={minRequiredCount}
                onChange={(e) => setMinRequiredCount(Number(e.target.value))}
                className="w-20 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-900 dark:text-white">of this tier present</span>
              <select
                required
                value={requiredTierId}
                onChange={(e) => setRequiredTierId(e.target.value)}
                className="w-48 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                <option value="">Select…</option>
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <button className="rounded-xl bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700 shadow-sm shadow-teal-600/20">
              Add rule
            </button>
          </form>
        )}

        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          {pairings.length === 0 && (
            <p className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No pairing rules yet.</p>
          )}
          {pairings.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 px-5 py-3 last:border-0 text-sm"
            >
              <span className="text-slate-900 dark:text-white">
                {p.dependentTier.name} always needs &ge;{p.minRequiredCount} {p.requiredTier.name}
              </span>
              <button
                onClick={() => deletePairing(p.id)}
                className="text-xs text-slate-400 hover:text-red-600 dark:hover:text-red-400"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface EligibilityFlags {
  eligible: boolean;
  weekendEligible: boolean;
  holidayEligible: boolean;
}

function EligibilityMatrix({
  tiers,
  shifts,
  eligibility,
  onSaved,
}: {
  tiers: TierRow[];
  shifts: ShiftOption[];
  eligibility: EligibilityRow[];
  onSaved: () => void;
}) {
  // A missing row means "eligible" — the engine only restricts where a row says otherwise.
  const [rows, setRows] = useState<
    Record<string, EligibilityFlags>
  >(() => {
    const map: Record<string, EligibilityFlags> = {};
    for (const e of eligibility) {
      map[`${e.tierId}|${e.shiftCode}`] = {
        eligible: e.eligible,
        weekendEligible: e.weekendEligible,
        holidayEligible: e.holidayEligible,
      };
    }
    return map;
  });
  const [saving, setSaving] = useState(false);

  const get = (tierId: string, code: string) =>
    rows[`${tierId}|${code}`] ??
    { eligible: true, weekendEligible: true, holidayEligible: true };

  const set = (
    tierId: string,
    code: string,
    patch: Partial<EligibilityFlags>,
  ) =>
    setRows((r) => ({
      ...r,
      [`${tierId}|${code}`]: { ...get(tierId, code), ...patch },
    }));

  async function save() {
    setSaving(true);
    const items = tiers.flatMap((t) =>
      shifts.map((s) => ({ tierId: t.id, shiftCode: s.code, ...get(t.id, s.code) })),
    );
    await api("/api/tier-eligibility", { method: "PUT", body: JSON.stringify({ items }) });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-1 text-lg font-semibold text-slate-900 dark:text-white">
          Shift eligibility
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Which shifts each tier may work. Uncheck a shift to bar the tier from it (e.g.
          senior staff on mornings only); uncheck{" "}
          <span className="font-medium">Weekends</span> or{" "}
          <span className="font-medium">Holidays</span> to keep a tier off those days
          entirely.
        </p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-left text-slate-700 dark:text-slate-300">
              <th className="px-5 py-3 font-medium">Tier</th>
              {shifts.map((s) => (
                <th key={s.code} className="px-5 py-3 font-medium">
                  {s.label}
                </th>
              ))}
              <th className="px-5 py-3 font-medium">Weekends</th>
              <th className="px-5 py-3 font-medium">Holidays</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => (
              <tr
                key={t.id}
                className="border-b border-slate-100 dark:border-slate-800/50 last:border-0"
              >
                <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">
                  {t.name}
                </td>
                {shifts.map((s) => (
                  <td key={s.code} className="px-5 py-3">
                    <input
                      type="checkbox"
                      checked={get(t.id, s.code).eligible}
                      onChange={(e) => set(t.id, s.code, { eligible: e.target.checked })}
                      className="h-4 w-4 accent-teal-600"
                    />
                  </td>
                ))}
                <td className="px-5 py-3">
                  <input
                    type="checkbox"
                    checked={shifts.every((s) => get(t.id, s.code).weekendEligible)}
                    onChange={(e) =>
                      shifts.forEach((s) =>
                        set(t.id, s.code, { weekendEligible: e.target.checked }),
                      )
                    }
                    className="h-4 w-4 accent-teal-600"
                  />
                </td>
                <td className="px-5 py-3">
                  <input
                    type="checkbox"
                    checked={shifts.every((s) => get(t.id, s.code).holidayEligible)}
                    onChange={(e) =>
                      shifts.forEach((s) =>
                        set(t.id, s.code, { holidayEligible: e.target.checked }),
                      )
                    }
                    className="h-4 w-4 accent-teal-600"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 shadow-sm shadow-teal-600/20"
      >
        {saving ? "Saving…" : "Save shift eligibility"}
      </button>
    </div>
  );
}
