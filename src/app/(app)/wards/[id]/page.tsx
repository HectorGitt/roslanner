"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Role {
  id: string;
  name: string;
}
interface Tier {
  id: string;
  name: string;
  rank: number;
}
interface StaffRow {
  id: string;
  name: string;
  active: boolean;
  role: Role;
  tierId: string | null;
  tier: Tier | null;
  floatWards: { wardId: string; ward: { id: string; name: string } }[];
}
/** Someone based in another ward who can also be rostered here. */
interface FloatIn {
  staff: { id: string; name: string; role: Role; tier: Tier | null; ward: { id: string; name: string } };
}
interface ShiftDef {
  id: string;
  code: string;
  label: string;
  startMinutes: number;
  endMinutes: number;
  isNightLike: boolean;
  payrollTag: string | null;
  sortOrder: number;
}
interface Requirement {
  shift: string;
  roleId: string | null;
  tierId: string | null;
  required: number;
}
interface Rules {
  maxConsecutiveDays: number;
  maxNightsPerWeek: number;
  minDaysOffPerWeek: number;
  maxConsecutiveNights: number;
  minRestHours: number | null;
}
interface Ward {
  id: string;
  name: string;
  category: string;
  cycleLengthDays: number;
  staff: StaffRow[];
  requirements: Requirement[];
  rules: Rules | null;
  shiftDefinitions: ShiftDef[];
  floatStaff: FloatIn[];
}

const DEFAULT_RULES: Rules = {
  maxConsecutiveDays: 6,
  maxNightsPerWeek: 3,
  minDaysOffPerWeek: 1,
  maxConsecutiveNights: 4,
  minRestHours: 8,
};

type Tab = "staff" | "shifts" | "coverage" | "rules";

export default function WardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ward, setWard] = useState<Ward | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [otherWards, setOtherWards] = useState<{ id: string; name: string }[]>([]);
  const [tab, setTab] = useState<Tab>("staff");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const [w, r, t, all] = await Promise.all([
      api<Ward>(`/api/wards/${id}`),
      api<Role[]>("/api/roles"),
      api<Tier[]>("/api/tiers"),
      api<{ id: string; name: string }[]>("/api/wards"),
    ]);
    setWard(w);
    setRoles(r);
    setTiers(t);
    setOtherWards(all.filter((x) => x.id !== id));
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
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {ward.category} · {ward.cycleLengthDays}-day cycle ·{" "}
          {ward.shiftDefinitions.length} shift
          {ward.shiftDefinitions.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {(
          [
            ["staff", `Staff (${ward.staff.length})`],
            ["shifts", "Shifts"],
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
        <StaffTab
          ward={ward}
          roles={roles}
          tiers={tiers}
          otherWards={otherWards}
          onChanged={load}
        />
      )}
      {tab === "shifts" && (
        <ShiftsTab
          ward={ward}
          onSaved={(msg) => {
            setNotice(msg);
            setTimeout(() => setNotice(""), 5000);
            load();
          }}
        />
      )}
      {tab === "coverage" && (
        <CoverageTab
          ward={ward}
          roles={roles}
          tiers={tiers}
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
  tiers,
  otherWards,
  onChanged,
}: {
  ward: Ward;
  roles: Role[];
  tiers: Tier[];
  otherWards: { id: string; name: string }[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [tierId, setTierId] = useState("");
  const [error, setError] = useState("");

  async function addStaff(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/staff", {
        method: "POST",
        body: JSON.stringify({
          name,
          roleId: roleId || roles[0]?.id,
          wardId: ward.id,
          tierId: tierId || null,
        }),
      });
      setName("");
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function changeTier(staffId: string, newTierId: string) {
    await api(`/api/staff/${staffId}`, {
      method: "PATCH",
      body: JSON.stringify({ tierId: newTierId || null }),
    });
    onChanged();
  }

  async function setFloatWards(s: StaffRow, wardIds: string[]) {
    await api(`/api/staff/${s.id}`, {
      method: "PATCH",
      body: JSON.stringify({ floatWardIds: wardIds }),
    });
    onChanged();
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
        {tiers.length > 0 && (
          <select
            value={tierId}
            onChange={(e) => setTierId(e.target.value)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm text-slate-900 dark:text-white shadow-sm"
          >
            <option value="">No tier</option>
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
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
            className="border-b border-slate-100 dark:border-slate-800/50 px-5 py-4 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`font-medium ${s.active ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-600 line-through"}`}>
                  {s.name}
                </span>
                <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400">
                  {s.role.name}
                </span>
                {tiers.length > 0 && (
                  <select
                    value={s.tierId ?? ""}
                    onChange={(e) => changeTier(s.id, e.target.value)}
                    className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400"
                  >
                    <option value="">No tier</option>
                    {tiers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
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
            {otherWards.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-400 dark:text-slate-500">Can also work:</span>
                {s.floatWards.length === 0 && (
                  <span className="text-slate-400 dark:text-slate-600">this ward only</span>
                )}
                {s.floatWards.map((fw) => (
                  <button
                    key={fw.wardId}
                    onClick={() =>
                      setFloatWards(
                        s,
                        s.floatWards.filter((x) => x.wardId !== fw.wardId).map((x) => x.wardId),
                      )
                    }
                    title="Remove"
                    className="group flex items-center gap-1 rounded-md bg-teal-50 dark:bg-teal-500/10 px-2 py-0.5 text-teal-700 dark:text-teal-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300"
                  >
                    {fw.ward.name}
                    <span className="text-teal-400 group-hover:text-rose-500">&times;</span>
                  </button>
                ))}
                <select
                  value=""
                  onChange={(e) =>
                    e.target.value &&
                    setFloatWards(s, [...s.floatWards.map((x) => x.wardId), e.target.value])
                  }
                  className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-1.5 py-0.5 text-xs text-slate-500 dark:text-slate-400"
                >
                  <option value="">+ ward</option>
                  {otherWards
                    .filter((w) => !s.floatWards.some((fw) => fw.wardId === w.id))
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>

      {ward.floatStaff.length > 0 && (
        <div>
          <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
            Also available here
          </h2>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Based in another ward but eligible to be rostered here. They can&apos;t be
            booked on a day they&apos;re already working elsewhere.
          </p>
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            {ward.floatStaff.map(({ staff: fs }) => (
              <div
                key={fs.id}
                className="flex flex-wrap items-center gap-3 border-b border-slate-100 dark:border-slate-800/50 px-5 py-3 last:border-0 text-sm"
              >
                <span className="font-medium text-slate-900 dark:text-white">{fs.name}</span>
                <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400">
                  {fs.role.name}
                </span>
                {fs.tier && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">{fs.tier.name}</span>
                )}
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  based in{" "}
                  <Link
                    href={`/wards/${fs.ward.id}`}
                    className="underline hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {fs.ward.name}
                  </Link>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CoverageTab({
  ward,
  roles,
  tiers,
  onSaved,
}: {
  ward: Ward;
  roles: Role[];
  tiers: Tier[];
  onSaved: () => void;
}) {
  // Rows are scoped by role or by tier; the key encodes which.
  const rowKey = (scope: "role" | "tier", id: string) => `${scope}:${id}`;
  const cellKey = (shiftCode: string, scope: string) => `${shiftCode}|${scope}`;
  const [values, setValues] = useState<Record<string, number>>(() => {
    const v: Record<string, number> = {};
    for (const r of ward.requirements) {
      const scope = r.tierId
        ? rowKey("tier", r.tierId)
        : r.roleId
          ? rowKey("role", r.roleId)
          : null;
      if (scope) v[cellKey(r.shift, scope)] = r.required;
    }
    return v;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const shifts = ward.shiftDefinitions;

  // Roles with staff here, plus any already used in requirements.
  const usedRoleIds = new Set([
    ...ward.staff.map((s) => s.role.id),
    ...ward.requirements.map((r) => r.roleId).filter(Boolean),
  ]);
  const shownRoles = roles.filter((r) => usedRoleIds.has(r.id));
  const displayRoles = shownRoles.length > 0 ? shownRoles : roles;

  async function save() {
    setSaving(true);
    setError('');
    try {
      const items = Object.entries(values)
        .filter(([, required]) => Number(required) > 0)
        .map(([key, required]) => {
          const [shift, scope] = key.split('|');
          const [kind, id] = scope.split(':');
          return {
            shift,
            roleId: kind === 'role' ? id : null,
            tierId: kind === 'tier' ? id : null,
            required: Number(required),
          };
        });
      await api('/api/coverage', {
        method: 'PUT',
        body: JSON.stringify({ wardId: ward.id, items }),
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (shifts.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Define this ward&apos;s shifts first on the <b>Shifts</b> tab.
      </p>
    );
  }

  const cellFor = (shiftCode: string, scope: string) => {
    const key = cellKey(shiftCode, scope);
    return (
      <td key={shiftCode} className="px-5 py-3">
        <input
          type="number"
          min={0}
          value={values[key] ?? 0}
          onChange={(e) => setValues((v) => ({ ...v, [key]: Number(e.target.value) }))}
          className="w-20 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500 shadow-sm"
        />
      </td>
    );
  };

  return (
    <div className="max-w-3xl space-y-5">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Minimum staff on duty for each shift, every day. Role rows cover skill mix;
        tier rows set a seniority floor (e.g. at least one senior on every shift),
        and both are enforced together.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-left text-slate-700 dark:text-slate-300">
              <th className="px-5 py-3 font-medium">Requirement</th>
              {shifts.map((sd) => (
                <th key={sd.id} className="px-5 py-3 font-medium">
                  {sd.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRoles.map((r) => (
              <tr
                key={r.id}
                className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
              >
                <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{r.name}</td>
                {shifts.map((sd) => cellFor(sd.code, rowKey('role', r.id)))}
              </tr>
            ))}
            {tiers.length > 0 && (
              <tr className="border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/60 dark:bg-slate-800/30">
                <td
                  colSpan={shifts.length + 1}
                  className="px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Seniority floors
                </td>
              </tr>
            )}
            {tiers.map((t) => (
              <tr
                key={t.id}
                className="border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
              >
                <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">
                  {t.name}
                  <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                    any role
                  </span>
                </td>
                {shifts.map((sd) => cellFor(sd.code, rowKey('tier', t.id)))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 shadow-sm shadow-teal-600/20 transition-all"
      >
        {saving ? 'Saving…' : 'Save coverage'}
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
      <label className="block">
        <span className="text-sm font-medium text-slate-900 dark:text-white">
          Minimum rest between shifts
        </span>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={24}
            value={rules.minRestHours ?? ""}
            placeholder="off"
            onChange={(e) =>
              setRules((r) => ({
                ...r,
                minRestHours: e.target.value === "" ? null : Number(e.target.value),
              }))
            }
            className="w-28 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500 shadow-sm"
          />
          <span className="text-sm text-slate-500 dark:text-slate-400">hours</span>
        </div>
        <span className="mt-1.5 block text-xs text-slate-500 dark:text-slate-400">
          Computed from each shift&apos;s actual times, so it catches any
          too-quick turnaround — not just a morning after a night. Leave blank to
          disable.
        </span>
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

/** Minutes-from-midnight <-> "HH:MM" for the time inputs. */
function toTimeValue(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function fromTimeValue(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

interface DraftShift {
  code: string;
  label: string;
  startMinutes: number;
  endMinutes: number;
  isNightLike: boolean;
  payrollTag: string | null;
}

function ShiftsTab({
  ward,
  onSaved,
}: {
  ward: Ward;
  onSaved: (message: string) => void;
}) {
  const [shifts, setShifts] = useState<DraftShift[]>(() =>
    ward.shiftDefinitions.map((sd) => ({
      code: sd.code,
      label: sd.label,
      startMinutes: sd.startMinutes,
      endMinutes: sd.endMinutes,
      isNightLike: sd.isNightLike,
      payrollTag: sd.payrollTag,
    })),
  );
  const [category, setCategory] = useState(ward.category);
  const [cycleLengthDays, setCycleLengthDays] = useState(ward.cycleLengthDays);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (i: number, patch: Partial<DraftShift>) =>
    setShifts((s) => s.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const addShift = () =>
    setShifts((s) => [
      ...s,
      {
        code: "",
        label: "",
        startMinutes: 8 * 60,
        endMinutes: 16 * 60,
        isNightLike: false,
        payrollTag: null,
      },
    ]);

  const removeShift = (i: number) => setShifts((s) => s.filter((_, idx) => idx !== i));

  async function save() {
    setSaving(true);
    setError("");
    try {
      // Ward settings and shifts are separate endpoints; both must land.
      await api(`/api/wards/${ward.id}`, {
        method: "PATCH",
        body: JSON.stringify({ category, cycleLengthDays }),
      });
      const res = await api<{ orphanedAssignments: number }>("/api/shift-definitions", {
        method: "PUT",
        body: JSON.stringify({ wardId: ward.id, items: shifts }),
      });
      onSaved(
        res.orphanedAssignments > 0
          ? `Shifts saved. ${res.orphanedAssignments} assignment(s) in existing rosters use a shift you removed — re-optimise those rosters to clear them.`
          : "Shifts saved.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="grid gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-900 dark:text-white">
            Ward type
          </span>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Standard, Call Duty, Outpatient Clinic"
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500"
          />
          <span className="mt-1.5 block text-xs text-slate-500 dark:text-slate-400">
            Your own label — purely descriptive.
          </span>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-900 dark:text-white">
            Roster cycle length
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={62}
              value={cycleLengthDays}
              onChange={(e) => setCycleLengthDays(Number(e.target.value))}
              className="w-28 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500"
            />
            <span className="text-sm text-slate-500 dark:text-slate-400">days</span>
          </div>
          <span className="mt-1.5 block text-xs text-slate-500 dark:text-slate-400">
            Default length when generating a roster: 7 for weekly, 30 for a monthly stretch.
          </span>
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Shifts in this ward
          </h2>
          <button
            onClick={addShift}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            + Add shift
          </button>
        </div>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          A shift ending at or before its start time is treated as running past
          midnight. Mark overnight shifts as nights so the night caps, rest rules
          and fairness balancing apply to them.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-left text-slate-700 dark:text-slate-300">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Start</th>
                <th className="px-4 py-3 font-medium">End</th>
                <th className="px-4 py-3 font-medium">Night</th>
                <th className="px-4 py-3 font-medium">Payroll tag</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {shifts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No shifts — a ward needs at least one to be rostered.
                  </td>
                </tr>
              )}
              {shifts.map((s, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                  <td className="px-4 py-2">
                    <input
                      value={s.label}
                      onChange={(e) => update(i, { label: e.target.value })}
                      placeholder="Morning"
                      className="w-32 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={s.code}
                      onChange={(e) => update(i, { code: e.target.value })}
                      placeholder="MORNING"
                      className="w-32 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-900 dark:text-white outline-none focus:border-teal-500"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="time"
                      value={toTimeValue(s.startMinutes)}
                      onChange={(e) => update(i, { startMinutes: fromTimeValue(e.target.value) })}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="time"
                      value={toTimeValue(s.endMinutes)}
                      onChange={(e) => update(i, { endMinutes: fromTimeValue(e.target.value) })}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500"
                    />
                    {s.endMinutes <= s.startMinutes && (
                      <span className="ml-2 text-[11px] text-slate-500 dark:text-slate-400">
                        next day
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={s.isNightLike}
                      onChange={(e) => update(i, { isNightLike: e.target.checked })}
                      className="h-4 w-4 accent-teal-600"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={s.payrollTag ?? ""}
                      onChange={(e) => update(i, { payrollTag: e.target.value || null })}
                      placeholder="optional"
                      className="w-36 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-teal-500"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => removeShift(i)}
                      className="text-xs text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 shadow-sm shadow-teal-600/20 transition-all"
      >
        {saving ? "Saving…" : "Save shifts & settings"}
      </button>
    </div>
  );
}
