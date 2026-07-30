"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyRow,
  Field,
  Input,
  ListCard,
  LoadingState,
  Select,
  TextButton,
  inputSmClass,
  thClass,
  theadRowClass,
} from "@/components/ui";

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
  canBeLead: boolean;
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
  daysOfWeek: number[];
  holidayRule: string;
}
interface WardRuleRow {
  id: string;
  type: string;
  params: Record<string, number>;
  tierId: string | null;
  tier: { id: string; name: string } | null;
  shiftCode: string | null;
  enabled: boolean;
}
interface Rules {
  maxConsecutiveDays: number;
  maxNightsPerWeek: number;
  minDaysOffPerWeek: number;
  maxConsecutiveNights: number;
  minRestHours: number | null;
  fairnessWindowDays: number;
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

/**
 * What the selected group currently has of its own, so it's clear whether you're
 * about to create an override or edit one. A group with nothing of its own uses
 * the ward's; saving anything here replaces the ward's for that group entirely.
 */
function inheritLabel(
  tab: Tab,
  scoped: { requirements: unknown[]; rules: unknown; shiftDefinitions: unknown[] } | null,
): string {
  if (!scoped) return "";
  const has =
    tab === "shifts"
      ? scoped.shiftDefinitions.length > 0
      : tab === "coverage"
        ? scoped.requirements.length > 0
        : scoped.rules !== null;
  return has
    ? "Overriding the ward — this group uses only what's set here."
    : "Nothing set, so this group uses the ward's. Saving here overrides it.";
}

const DEFAULT_RULES: Rules = {
  maxConsecutiveDays: 6,
  maxNightsPerWeek: 3,
  minDaysOffPerWeek: 1,
  maxConsecutiveNights: 4,
  minRestHours: 8,
  fairnessWindowDays: 0,
};

interface GroupRow {
  id: string;
  name: string;
  roles: { id: string; name: string }[];
}

type Tab = "staff" | "shifts" | "coverage" | "rules";

export default function WardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ward, setWard] = useState<Ward | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [otherWards, setOtherWards] = useState<{ id: string; name: string }[]>([]);
  const [tab, setTab] = useState<Tab>("staff");
  const [groups, setGroups] = useState<GroupRow[]>([]);
  /** "" = the ward's own config; otherwise the group whose config we're editing. */
  const [scope, setScope] = useState("");
  const [scoped, setScoped] = useState<{
    scope: string;
    requirements: Requirement[];
    rules: Rules | null;
    shiftDefinitions: ShiftDef[];
  } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const [w, r, t, all, g] = await Promise.all([
      api<Ward>(`/api/wards/${id}`),
      api<Role[]>("/api/roles"),
      api<Tier[]>("/api/tiers"),
      api<{ id: string; name: string }[]>("/api/wards"),
      api<GroupRow[]>("/api/groups"),
    ]);
    setWard(w);
    setRoles(r);
    setTiers(t);
    setOtherWards(all.filter((x) => x.id !== id));
    setGroups(g);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Shifts, coverage and rules all exist per scope, so they're fetched for the
  // selected one rather than taken from the ward payload (which holds every scope).
  const loadScoped = useCallback(async () => {
    const q = scope ? `&groupId=${scope}` : "";
    const [requirements, rules, shiftDefinitions] = await Promise.all([
      api<Requirement[]>(`/api/coverage?wardId=${id}${q}`),
      api<Rules | null>(`/api/rules?wardId=${id}${q}`),
      api<ShiftDef[]>(`/api/shift-definitions?wardId=${id}${q}`),
    ]);
    setScoped({ scope, requirements, rules, shiftDefinitions });
  }, [id, scope]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadScoped();
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadScoped]);

  const config = scoped?.scope === scope ? scoped : null;

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!ward) return <LoadingState label="Loading ward…" />;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/wards" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
          &larr; All wards
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">{ward.name}</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {ward.category} · {ward.cycleLengthDays}-day cycle ·{" "}
          {ward.shiftDefinitions.length} shift
          {ward.shiftDefinitions.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="flex gap-6 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
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
            className={`-mb-px whitespace-nowrap border-b-2 px-1 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
              tab === t
                ? "border-emerald-500 text-emerald-700 dark:text-emerald-400"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== "staff" && groups.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
          <label className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Editing config for
            </span>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className={inputSmClass}
            >
              <option value="">the whole ward</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} only
                </option>
              ))}
            </select>
            {scope && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {inheritLabel(tab, config)}
              </span>
            )}
          </label>
        </div>
      )}

      {notice && <Alert tone="success">{notice}</Alert>}

      {tab === "staff" && (
        <StaffTab
          ward={ward}
          roles={roles}
          tiers={tiers}
          otherWards={otherWards}
          onChanged={load}
        />
      )}
      {tab === "shifts" && config && (
        <ShiftsTab
          key={`shifts-${scope}`}
          ward={{ ...ward, ...config }}
          groupId={scope}
          onSaved={(msg) => {
            setNotice(msg);
            setTimeout(() => setNotice(""), 5000);
            load();
            loadScoped();
          }}
        />
      )}
      {tab === "coverage" && config && (
        <CoverageTab
          key={`coverage-${scope}`}
          ward={{ ...ward, ...config }}
          groupId={scope}
          roles={roles}
          tiers={tiers}
          onSaved={() => {
            setNotice("Coverage saved.");
            setTimeout(() => setNotice(""), 2500);
            load();
            loadScoped();
          }}
        />
      )}
      {tab === "rules" && config && (
        <RulesTab
          key={`rules-${scope}`}
          ward={{ ...ward, ...config }}
          groupId={scope}
          tiers={tiers}
          onSaved={() => {
            setNotice("Rules saved.");
            setTimeout(() => setNotice(""), 2500);
            load();
            loadScoped();
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

  async function toggleLead(s: StaffRow) {
    await api("/api/staff/" + s.id, {
      method: "PATCH",
      body: JSON.stringify({ canBeLead: !s.canBeLead }),
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
      <p className="text-sm text-zinc-500">
        Create at least one <Link href="/roles" className="text-emerald-700 underline">role</Link>{" "}
        (e.g. Doctor, Nurse) before adding staff.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addStaff} className="flex flex-wrap gap-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Staff name"
          className="w-64"
        />
        <Select value={roleId || roles[0]?.id} onChange={(e) => setRoleId(e.target.value)}>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
        {tiers.length > 0 && (
          <Select value={tierId} onChange={(e) => setTierId(e.target.value)}>
            <option value="">No tier</option>
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        )}
        <Button type="submit">Add staff</Button>
      </form>
      {error && <Alert tone="error">{error}</Alert>}

      <ListCard>
        {ward.staff.length === 0 && <EmptyRow>No staff yet.</EmptyRow>}
        {ward.staff.map((s) => (
          <div
            key={s.id}
            className="px-5 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          >
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`font-medium ${s.active ? "text-zinc-900 dark:text-white" : "text-zinc-400 dark:text-zinc-600 line-through"}`}>
                  {s.name}
                </span>
                <Badge tone="neutral" className="font-medium">
                  {s.role.name}
                </Badge>
                {tiers.length > 0 && (
                  <select
                    value={s.tierId ?? ""}
                    onChange={(e) => changeTier(s.id, e.target.value)}
                    className={`${inputSmClass} px-2 py-0.5 text-xs`}
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
                  onClick={() => toggleLead(s)}
                  title="Whether this person can be put in charge of a shift"
                  className={`rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
                    s.canBeLead
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  }`}
                >
                  {s.canBeLead ? "Can lead ✓" : "Can lead"}
                </button>
                <TextButton onClick={() => toggleActive(s)}>
                  {s.active ? "Deactivate" : "Activate"}
                </TextButton>
                <TextButton tone="danger" onClick={() => removeStaff(s.id, s.name)}>
                  Delete
                </TextButton>
              </div>
            </div>
            {otherWards.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-zinc-400 dark:text-zinc-500">Can also work:</span>
                {s.floatWards.length === 0 && (
                  <span className="text-zinc-400 dark:text-zinc-600">this ward only</span>
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
                    className="group flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300"
                  >
                    {fw.ward.name}
                    <span className="text-emerald-400 group-hover:text-rose-500">&times;</span>
                  </button>
                ))}
                <select
                  value=""
                  onChange={(e) =>
                    e.target.value &&
                    setFloatWards(s, [...s.floatWards.map((x) => x.wardId), e.target.value])
                  }
                  className={`${inputSmClass} px-1.5 py-0.5 text-xs`}
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
      </ListCard>

      {ward.floatStaff.length > 0 && (
        <div>
          <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-white">
            Also available here
          </h2>
          <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
            Based in another ward but eligible to be rostered here. They can&apos;t be
            booked on a day they&apos;re already working elsewhere.
          </p>
          <ListCard>
            {ward.floatStaff.map(({ staff: fs }) => (
              <div
                key={fs.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"
              >
                <span className="font-medium text-zinc-900 dark:text-white">{fs.name}</span>
                <Badge tone="neutral" className="font-medium">
                  {fs.role.name}
                </Badge>
                {fs.tier && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{fs.tier.name}</span>
                )}
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  based in{" "}
                  <Link
                    href={`/wards/${fs.ward.id}`}
                    className="underline hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    {fs.ward.name}
                  </Link>
                </span>
              </div>
            ))}
          </ListCard>
        </div>
      )}
    </div>
  );
}

function CoverageTab({
  ward,
  groupId,
  roles,
  tiers,
  onSaved,
}: {
  ward: Ward;
  /** "" = the ward's own coverage; otherwise the group this override belongs to. */
  groupId: string;
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
  // Day scoping is per requirement row (role or tier), not per cell — a clinic
  // shuts on the same days whichever session you look at.
  const [scoping, setScoping] = useState<Record<string, { days: number[]; holidayRule: string }>>(
    () => {
      const m: Record<string, { days: number[]; holidayRule: string }> = {};
      for (const r of ward.requirements) {
        const scope = r.tierId
          ? rowKey("tier", r.tierId)
          : r.roleId
            ? rowKey("role", r.roleId)
            : null;
        if (scope) m[scope] = { days: r.daysOfWeek ?? [], holidayRule: r.holidayRule ?? "SAME" };
      }
      return m;
    },
  );
  const scopeOf = (scope: string) => scoping[scope] ?? { days: [], holidayRule: "SAME" };
  const toggleDay = (scope: string, dow: number) =>
    setScoping((m) => {
      const cur = scopeOf(scope);
      const days = cur.days.includes(dow)
        ? cur.days.filter((d) => d !== dow)
        : [...cur.days, dow].sort();
      return { ...m, [scope]: { ...cur, days } };
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
          const sc = scopeOf(scope);
          return {
            shift,
            roleId: kind === 'role' ? id : null,
            tierId: kind === 'tier' ? id : null,
            required: Number(required),
            daysOfWeek: sc.days,
            holidayRule: sc.holidayRule,
          };
        });
      await api('/api/coverage', {
        method: 'PUT',
        body: JSON.stringify({ wardId: ward.id, groupId: groupId || null, items }),
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
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Define this ward&apos;s shifts first on the <b>Shifts</b> tab.
      </p>
    );
  }

  const cellFor = (shiftCode: string, scope: string) => {
    const key = cellKey(shiftCode, scope);
    return (
      <td key={shiftCode} className="px-5 py-3">
        <Input
          type="number"
          min={0}
          value={values[key] ?? 0}
          onChange={(e) => setValues((v) => ({ ...v, [key]: Number(e.target.value) }))}
          className="w-20"
        />
      </td>
    );
  };

  const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const dayPickerFor = (scope: string) => {
    const sc = scopeOf(scope);
    const everyDay = sc.days.length === 0;
    return (
      <td key="days" className="px-5 py-3 whitespace-nowrap">
        <div className="flex items-center gap-0.5">
          {DOW.map((label, dow) => {
            const on = everyDay || sc.days.includes(dow);
            return (
              <button
                key={dow}
                type="button"
                onClick={() => toggleDay(scope, dow)}
                title={everyDay ? "Applies every day — click to restrict" : label}
                className={`h-6 w-6 rounded text-[10px] font-medium transition-colors ${
                  on
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                    : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600"
                }`}
              >
                {label}
              </button>
            );
          })}
          <select
            value={sc.holidayRule}
            onChange={(e) =>
              setScoping((m) => ({ ...m, [scope]: { ...sc, holidayRule: e.target.value } }))
            }
            title="How public holidays are treated"
            className={`${inputSmClass} ml-2 px-1.5 py-0.5 text-[11px]`}
          >
            <option value="SAME">holidays: as normal</option>
            <option value="EXCLUDE">holidays: closed</option>
            <option value="ONLY">holidays only</option>
          </select>
        </div>
      </td>
    );
  };

  return (
    <div className="max-w-5xl space-y-5">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Minimum staff on duty for each shift. Role rows cover skill mix;
        tier rows set a seniority floor (e.g. at least one senior on every shift),
        and both are enforced together. Use <span className="font-medium">Applies on</span>{" "}
        to limit a requirement to certain days — a clinic that shuts at the weekend, or
        lighter cover on public holidays.
      </p>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={theadRowClass}>
              <th className={`${thClass} px-5`}>Requirement</th>
              {shifts.map((sd) => (
                <th key={sd.id} className={`${thClass} px-5`}>
                  {sd.label}
                </th>
              ))}
              <th className={`${thClass} px-5`}>Applies on</th>
            </tr>
          </thead>
          <tbody>
            {displayRoles.map((r) => (
              <tr
                key={r.id}
                className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors"
              >
                <td className="px-5 py-3 font-medium text-zinc-900 dark:text-white">{r.name}</td>
                {shifts.map((sd) => cellFor(sd.code, rowKey('role', r.id)))}
                {dayPickerFor(rowKey('role', r.id))}
              </tr>
            ))}
            {tiers.length > 0 && (
              <tr className="border-b border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/60 dark:bg-zinc-800/30">
                <td
                  colSpan={shifts.length + 2}
                  className="px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
                >
                  Seniority floors
                </td>
              </tr>
            )}
            {tiers.map((t) => (
              <tr
                key={t.id}
                className="border-b border-zinc-100 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors"
              >
                <td className="px-5 py-3 font-medium text-zinc-900 dark:text-white">
                  {t.name}
                  <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                    any role
                  </span>
                </td>
                {shifts.map((sd) => cellFor(sd.code, rowKey('tier', t.id)))}
                {dayPickerFor(rowKey('tier', t.id))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {error && <Alert tone="error">{error}</Alert>}
      <Button onClick={save} loading={saving}>
        {saving ? 'Saving…' : 'Save coverage'}
      </Button>
    </div>
  );
}

function RulesTab({
  ward,
  groupId,
  tiers,
  onSaved,
}: {
  ward: Ward;
  /** "" = the ward's own rules; otherwise the group these belong to. */
  groupId: string;
  tiers: Tier[];
  onSaved: () => void;
}) {
  const [rules, setRules] = useState<Rules>(ward.rules ?? DEFAULT_RULES);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await api("/api/rules", {
      method: "PUT",
      body: JSON.stringify({ wardId: ward.id, groupId: groupId || null, ...rules }),
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
    <Field label={label} hint={hint}>
      <Input
        type="number"
        min={0}
        value={rules[key]}
        onChange={(e) => setRules((r) => ({ ...r, [key]: Number(e.target.value) }))}
        className="block w-28"
      />
    </Field>
  );

  return (
    <div className="space-y-8">
      <Card className="max-w-xl space-y-6 p-6">
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
      <Field
        label="Minimum rest between shifts"
        hint="Computed from each shift's actual times, so it catches any too-quick turnaround — not just a morning after a night. Leave blank to disable."
      >
        <div className="flex items-center gap-2">
          <Input
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
            className="w-28"
          />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">hours</span>
        </div>
      </Field>
      <Field
        label="Balance fairness over"
        hint="Counts nights, weekends and holidays already worked in published rosters, so shares even out across periods instead of resetting each time. 0 judges each roster on its own."
      >
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={365}
            value={rules.fairnessWindowDays}
            onChange={(e) =>
              setRules((r) => ({ ...r, fairnessWindowDays: Number(e.target.value) }))
            }
            className="w-28"
          />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">days of history</span>
        </div>
      </Field>
      <Button onClick={save} loading={saving}>
        {saving ? "Saving…" : "Save rules"}
      </Button>
      </Card>
      <ExtraRulesPanel key={`extra-${groupId}`} ward={ward} groupId={groupId} tiers={tiers} />
    </div>
  );
}

/** Human wording for each rule type, and which parameter it takes. */
const RULE_INFO: Record<
  string,
  {
    label: string;
    describe: (p: Record<string, number>) => string;
    param?: { key: string; label: string; default: number };
  }
> = {
  BLOCK_PATTERN_ON_OFF: {
    label: "A block of nights earns the same time off",
    describe: (p) =>
      (p.blockDays ?? 7) + " or more nights in a row must be followed by as many days off",
    param: { key: "blockDays", label: "nights in a row", default: 7 },
  },
  CHARGE_LEAD_REQUIRED: {
    label: "Every shift needs someone in charge",
    describe: () => "One lead per worked shift, from staff marked as able to lead",
  },
  MAX_HOURS_PER_WEEK: {
    label: "Maximum hours in any 7 days",
    describe: (p) => "No more than " + (p.hours ?? 48) + "h in any rolling 7-day window",
    param: { key: "hours", label: "hours", default: 48 },
  },
};

/**
 * Rules that carry their own setting, kept apart from the plain numeric limits
 * because they may also apply to just one tier or one shift.
 */
function ExtraRulesPanel({
  ward,
  groupId,
  tiers,
}: {
  ward: Ward;
  /** "" = the ward's own extra rules; otherwise the group's. */
  groupId: string;
  tiers: Tier[];
}) {
  const [rules, setRules] = useState<WardRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [type, setType] = useState("BLOCK_PATTERN_ON_OFF");
  const [paramValue, setParamValue] = useState(7);
  const [tierId, setTierId] = useState("");
  const [shiftCode, setShiftCode] = useState("");

  const load = useCallback(
    () =>
      api<{ items: WardRuleRow[] }>(
        `/api/ward-rules?wardId=${ward.id}${groupId ? `&groupId=${groupId}` : ""}`,
      )
        .then((r) => setRules(r.items))
        .finally(() => setLoading(false)),
    [ward.id, groupId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const info = RULE_INFO[type];

  async function add(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/ward-rules", {
        method: "POST",
        body: JSON.stringify({
          wardId: ward.id,
          groupId: groupId || null,
          type,
          params: info.param ? { [info.param.key]: paramValue } : {},
          tierId: tierId || null,
          shiftCode: shiftCode || null,
        }),
      });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggle(r: WardRuleRow) {
    await api("/api/ward-rules/" + r.id, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !r.enabled }),
    });
    load();
  }

  async function remove(id: string) {
    await api("/api/ward-rules/" + id, { method: "DELETE" });
    load();
  }

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Additional rules</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Rules that need their own setting, and can apply to one tier or one shift
          rather than the whole ward.
        </p>
      </div>

      <Card className="p-4">
        <form onSubmit={add} className="space-y-3">
          <Select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setParamValue(RULE_INFO[e.target.value].param?.default ?? 0);
            }}
            className="w-full"
          >
            {Object.entries(RULE_INFO).map(([key, v]) => (
              <option key={key} value={key}>
                {v.label}
              </option>
            ))}
          </Select>
          <div className="flex flex-wrap items-end gap-3 text-sm">
            {info.param && (
              <label className="block">
                <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
                  {info.param.label}
                </span>
                <Input
                  type="number"
                  min={1}
                  value={paramValue}
                  onChange={(e) => setParamValue(Number(e.target.value))}
                  className="w-24"
                />
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">applies to</span>
              <Select value={tierId} onChange={(e) => setTierId(e.target.value)}>
                <option value="">every tier</option>
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">on</span>
              <Select value={shiftCode} onChange={(e) => setShiftCode(e.target.value)}>
                <option value="">every shift</option>
                {ward.shiftDefinitions.map((sd) => (
                  <option key={sd.id} value={sd.code}>
                    {sd.label}
                  </option>
                ))}
              </Select>
            </label>
            <Button type="submit">Add rule</Button>
          </div>
        </form>
      </Card>
      {error && <Alert tone="error">{error}</Alert>}

      <ListCard>
        {loading && (
          <p className="px-5 py-6 text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
        )}
        {!loading && rules.length === 0 && (
          <EmptyRow>No additional rules on this ward.</EmptyRow>
        )}
        {rules.map((r) => (
          <div
            key={r.id}
            className="flex items-start justify-between gap-3 px-5 py-3"
          >
            <div className={r.enabled ? "" : "opacity-50"}>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">
                {RULE_INFO[r.type]?.label ?? r.type}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {RULE_INFO[r.type]?.describe(r.params ?? {}) ?? ""}
                {r.tier ? " · " + r.tier.name + " only" : ""}
                {r.shiftCode ? " · " + r.shiftCode + " only" : ""}
                {r.enabled ? "" : " · off"}
              </p>
            </div>
            <div className="flex shrink-0 gap-3 text-xs">
              <TextButton onClick={() => toggle(r)}>
                {r.enabled ? "Disable" : "Enable"}
              </TextButton>
              <TextButton tone="danger" onClick={() => remove(r.id)}>
                Delete
              </TextButton>
            </div>
          </div>
        ))}
      </ListCard>
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
  groupId,
  onSaved,
}: {
  ward: Ward;
  /** "" = the ward's own shifts; otherwise the group these belong to. */
  groupId: string;
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
        body: JSON.stringify({ wardId: ward.id, groupId: groupId || null, items: shifts }),
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
      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Ward type" hint="Your own label — purely descriptive.">
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Standard, Call Duty, Outpatient Clinic"
            className="w-full"
          />
        </Field>
        <Field
          label="Roster cycle length"
          hint="Default length when generating a roster: 7 for weekly, 30 for a monthly stretch."
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={62}
              value={cycleLengthDays}
              onChange={(e) => setCycleLengthDays(Number(e.target.value))}
              className="w-28"
            />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">days</span>
          </div>
        </Field>
      </Card>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Shifts in this ward
          </h2>
          <Button variant="secondary" size="sm" onClick={addShift}>
            + Add shift
          </Button>
        </div>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          A shift ending at or before its start time is treated as running past
          midnight. Mark overnight shifts as nights so the night caps, rest rules
          and fairness balancing apply to them.
        </p>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={theadRowClass}>
                <th className={thClass}>Name</th>
                <th className={thClass}>Code</th>
                <th className={thClass}>Start</th>
                <th className={thClass}>End</th>
                <th className={thClass}>Night</th>
                <th className={thClass}>Payroll tag</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {shifts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    No shifts — a ward needs at least one to be rostered.
                  </td>
                </tr>
              )}
              {shifts.map((s, i) => (
                <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/50 last:border-0">
                  <td className="px-4 py-2">
                    <input
                      value={s.label}
                      onChange={(e) => update(i, { label: e.target.value })}
                      placeholder="Morning"
                      className={`${inputSmClass} w-32`}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={s.code}
                      onChange={(e) => update(i, { code: e.target.value })}
                      placeholder="MORNING"
                      className={`${inputSmClass} w-32 font-mono text-xs`}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="time"
                      value={toTimeValue(s.startMinutes)}
                      onChange={(e) => update(i, { startMinutes: fromTimeValue(e.target.value) })}
                      className={inputSmClass}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="time"
                      value={toTimeValue(s.endMinutes)}
                      onChange={(e) => update(i, { endMinutes: fromTimeValue(e.target.value) })}
                      className={inputSmClass}
                    />
                    {s.endMinutes <= s.startMinutes && (
                      <span className="ml-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                        next day
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={s.isNightLike}
                      onChange={(e) => update(i, { isNightLike: e.target.checked })}
                      className="h-4 w-4 rounded accent-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={s.payrollTag ?? ""}
                      onChange={(e) => update(i, { payrollTag: e.target.value || null })}
                      placeholder="optional"
                      className={`${inputSmClass} w-36 text-xs`}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <TextButton tone="danger" onClick={() => removeShift(i)}>
                      Remove
                    </TextButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      <Button onClick={save} loading={saving}>
        {saving ? "Saving…" : "Save shifts & settings"}
      </Button>
    </div>
  );
}
