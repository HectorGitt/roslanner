"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

const SHIFTS = ["MORNING", "AFTERNOON", "NIGHT"] as const;
const SHIFT_LABEL: Record<string, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  NIGHT: "Night",
};

interface Role {
  id: string;
  name: string;
}
interface StaffRow {
  id: string;
  name: string;
  active: boolean;
  role: Role;
}
interface Requirement {
  shift: string;
  roleId: string;
  required: number;
}
interface Rules {
  maxConsecutiveDays: number;
  maxNightsPerWeek: number;
  minDaysOffPerWeek: number;
  noMorningAfterNight: boolean;
  maxConsecutiveNights: number;
}
interface Ward {
  id: string;
  name: string;
  staff: StaffRow[];
  requirements: Requirement[];
  rules: Rules | null;
}

const DEFAULT_RULES: Rules = {
  maxConsecutiveDays: 6,
  maxNightsPerWeek: 3,
  minDaysOffPerWeek: 1,
  noMorningAfterNight: true,
  maxConsecutiveNights: 4,
};

type Tab = "staff" | "coverage" | "rules";

export default function WardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ward, setWard] = useState<Ward | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [tab, setTab] = useState<Tab>("staff");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const [w, r] = await Promise.all([
      api<Ward>(`/api/wards/${id}`),
      api<Role[]>("/api/roles"),
    ]);
    setWard(w);
    setRoles(r);
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!ward) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/wards" className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
          &larr; All wards
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{ward.name}</h1>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {(
          [
            ["staff", `Staff (${ward.staff.length})`],
            ["coverage", "Coverage"],
            ["rules", "Rules"],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t-xl px-5 py-2.5 text-sm font-medium transition-colors ${
              tab === t
                ? "border border-b-0 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {notice && <p className="text-sm text-emerald-600">{notice}</p>}

      {tab === "staff" && (
        <StaffTab ward={ward} roles={roles} onChanged={load} />
      )}
      {tab === "coverage" && (
        <CoverageTab
          ward={ward}
          roles={roles}
          onSaved={() => {
            setNotice("Coverage saved.");
            setTimeout(() => setNotice(""), 2500);
            load();
          }}
        />
      )}
      {tab === "rules" && (
        <RulesTab
          ward={ward}
          onSaved={() => {
            setNotice("Rules saved.");
            setTimeout(() => setNotice(""), 2500);
            load();
          }}
        />
      )}
    </div>
  );
}

function StaffTab({
  ward,
  roles,
  onChanged,
}: {
  ward: Ward;
  roles: Role[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState("");

  async function addStaff(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/staff", {
        method: "POST",
        body: JSON.stringify({ name, roleId: roleId || roles[0]?.id, wardId: ward.id }),
      });
      setName("");
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function removeStaff(id: string, staffName: string) {
    if (!confirm(`Remove ${staffName}? Their roster assignments will be deleted.`)) return;
    await api(`/api/staff/${id}`, { method: "DELETE" });
    onChanged();
  }

  async function toggleActive(s: StaffRow) {
    await api(`/api/staff/${s.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !s.active }),
    });
    onChanged();
  }

  if (roles.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Create at least one <Link href="/roles" className="text-teal-700 underline">role</Link>{" "}
        (e.g. Doctor, Nurse) before adding staff.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addStaff} className="flex flex-wrap gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Staff name"
          className="w-64 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500 shadow-sm"
        />
        <select
          value={roleId || roles[0]?.id}
          onChange={(e) => setRoleId(e.target.value)}
          className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm text-slate-900 dark:text-white shadow-sm"
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button className="rounded-xl bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700 shadow-sm shadow-teal-600/20 transition-all">
          Add staff
        </button>
      </form>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        {ward.staff.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No staff yet.</p>
        )}
        {ward.staff.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 px-5 py-4 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className={`font-medium ${s.active ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-600 line-through"}`}>
                {s.name}
              </span>
              <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400">
                {s.role.name}
              </span>
            </div>
            <div className="flex gap-4 text-xs font-medium">
              <button
                onClick={() => toggleActive(s)}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                {s.active ? "Deactivate" : "Activate"}
              </button>
              <button
                onClick={() => removeStaff(s.id, s.name)}
                className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
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

function CoverageTab({
  ward,
  roles,
  onSaved,
}: {
  ward: Ward;
  roles: Role[];
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const v: Record<string, number> = {};
    for (const r of ward.requirements) v[`${r.shift}|${r.roleId}`] = r.required;
    return v;
  });
  const [saving, setSaving] = useState(false);

  // Roles that actually have staff in this ward, plus any role already used in requirements
  const usedRoleIds = new Set([
    ...ward.staff.map((s) => s.role.id),
    ...ward.requirements.map((r) => r.roleId),
  ]);
  const shownRoles = roles.filter((r) => usedRoleIds.has(r.id));
  const displayRoles = shownRoles.length > 0 ? shownRoles : roles;

  async function save() {
    setSaving(true);
    const items = Object.entries(values)
      .map(([key, required]) => {
        const [shift, roleId] = key.split("|");
        return { shift, roleId, required: Number(required) || 0 };
      })
      .filter((i) => i.required > 0);
    await api("/api/coverage", {
      method: "PUT",
      body: JSON.stringify({ wardId: ward.id, items }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="max-w-2xl space-y-5">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        How many of each role must be on duty for each shift, every day.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-left text-slate-700 dark:text-slate-300">
              <th className="px-5 py-3 font-medium">Role</th>
              {SHIFTS.map((s) => (
                <th key={s} className="px-5 py-3 font-medium">
                  {SHIFT_LABEL[s]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRoles.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{r.name}</td>
                {SHIFTS.map((s) => {
                  const key = `${s}|${r.id}`;
                  return (
                    <td key={s} className="px-5 py-3">
                      <input
                        type="number"
                        min={0}
                        value={values[key] ?? 0}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [key]: Number(e.target.value) }))
                        }
                        className="w-20 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500 shadow-sm"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 shadow-sm shadow-teal-600/20 transition-all"
      >
        {saving ? "Saving…" : "Save coverage"}
      </button>
    </div>
  );
}

function RulesTab({ ward, onSaved }: { ward: Ward; onSaved: () => void }) {
  const [rules, setRules] = useState<Rules>(ward.rules ?? DEFAULT_RULES);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await api("/api/rules", {
      method: "PUT",
      body: JSON.stringify({ wardId: ward.id, ...rules }),
    });
    setSaving(false);
    onSaved();
  }

  const numField = (
    label: string,
    key: keyof Pick<
      Rules,
      "maxConsecutiveDays" | "maxNightsPerWeek" | "minDaysOffPerWeek" | "maxConsecutiveNights"
    >,
    hint: string,
  ) => (
    <label className="block">
      <span className="text-sm font-medium text-slate-900 dark:text-white">{label}</span>
      <input
        type="number"
        min={0}
        value={rules[key]}
        onChange={(e) => setRules((r) => ({ ...r, [key]: Number(e.target.value) }))}
        className="mt-1.5 block w-28 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500 shadow-sm"
      />
      <span className="mt-1.5 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
    </label>
  );

  return (
    <div className="max-w-xl space-y-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      {numField(
        "Max consecutive working days",
        "maxConsecutiveDays",
        "A day off is forced after this many days in a row.",
      )}
      {numField(
        "Max nights per week",
        "maxNightsPerWeek",
        "Counted over each 7-day block of the roster.",
      )}
      {numField(
        "Max consecutive nights",
        "maxConsecutiveNights",
        "Longest allowed run of night shifts.",
      )}
      {numField(
        "Min days off per week",
        "minDaysOffPerWeek",
        "Guaranteed days off in every full week.",
      )}
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={rules.noMorningAfterNight}
          onChange={(e) =>
            setRules((r) => ({ ...r, noMorningAfterNight: e.target.checked }))
          }
          className="h-4 w-4 accent-teal-600 rounded border-slate-300 dark:border-slate-700"
        />
        <span className="text-sm font-medium text-slate-900 dark:text-white">No morning shift straight after a night</span>
      </label>
      <button
        onClick={save}
        disabled={saving}
        className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 shadow-sm shadow-teal-600/20 transition-all"
      >
        {saving ? "Saving…" : "Save rules"}
      </button>
    </div>
  );
}
