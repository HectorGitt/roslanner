"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  EmptyRow,
  Field,
  Input,
  ListCard,
  LoadingState,
  PageHeader,
  Select,
  TextButton,
  thClass,
  theadRowClass,
} from "@/components/ui";

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

  if (loading) return <LoadingState label="Loading tiers…" />;

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader
        title="Staff tiers"
        description="Your own staff hierarchy — e.g. Senior Executive, Core Clinical, Rotational, Support. Shift eligibility and pairing rules below apply across every ward that uses the shift, so you only set them once."
      />

      <Card className="p-5">
        <form onSubmit={addTier} className="flex flex-wrap items-end gap-3">
          <Field label="Name">
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nurse Intern"
              className="w-52"
            />
          </Field>
          <Field label="Rank">
            <Input
              type="number"
              value={rank}
              onChange={(e) => setRank(Number(e.target.value))}
              className="w-20"
            />
          </Field>
          <Field label="Max consecutive nights">
            <Input
              type="number"
              min={0}
              value={maxNights}
              onChange={(e) => setMaxNights(e.target.value)}
              placeholder="ward default"
              className="w-36"
            />
          </Field>
          <label className="flex items-center gap-2 pb-2.5 text-sm">
            <Checkbox
              checked={countsTowardClinicalCoverage}
              onChange={(e) => setCounts(e.target.checked)}
            />
            <span
              className="font-medium text-zinc-700 dark:text-zinc-300"
              title="Uncheck for support staff (porters, attendants). Applies to tier-scoped coverage rules; role-based coverage is already role-specific."
            >
              Counts toward clinical coverage
            </span>
          </label>
          <Button type="submit">Add tier</Button>
        </form>
      </Card>
      {error && <Alert tone="error">{error}</Alert>}

      <ListCard>
        {tiers.length === 0 && <EmptyRow>No tiers yet.</EmptyRow>}
        {tiers.map((t) => (
          <div key={t.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <span className="font-medium text-zinc-900 dark:text-white">{t.name}</span>
              <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                rank {t.rank} · {t._count.staff} staff
                {!t.countsTowardClinicalCoverage && " · non-clinical"}
                {t.maxConsecutiveNights !== null && ` · max ${t.maxConsecutiveNights} consecutive nights`}
              </span>
            </div>
            <TextButton tone="danger" onClick={() => deleteTier(t.id)}>
              Delete
            </TextButton>
          </div>
        ))}
      </ListCard>

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
      {notice && <Alert tone="success">{notice}</Alert>}

      <div>
        <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-white">Pairing rules</h2>
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
          E.g. &quot;whenever a Nurse Intern is on shift, at least 1 Core Clinical staffer must also be
          on it&quot; — applies to every shift, in every ward.
        </p>
        {tiers.length < 2 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Add at least two tiers to create a pairing rule.
          </p>
        ) : (
          <Card className="p-5">
            <form onSubmit={addPairing} className="flex flex-wrap items-end gap-3">
              <Field label="When this tier works…">
                <Select
                  required
                  value={dependentTierId}
                  onChange={(e) => setDependentTierId(e.target.value)}
                  className="w-48"
                >
                  <option value="">Select…</option>
                  {tiers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="…require at least">
                <Input
                  type="number"
                  min={1}
                  value={minRequiredCount}
                  onChange={(e) => setMinRequiredCount(Number(e.target.value))}
                  className="w-20"
                />
              </Field>
              <Field label="of this tier present">
                <Select
                  required
                  value={requiredTierId}
                  onChange={(e) => setRequiredTierId(e.target.value)}
                  className="w-48"
                >
                  <option value="">Select…</option>
                  {tiers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Select>
              </Field>
              <Button type="submit">Add rule</Button>
            </form>
          </Card>
        )}

        <ListCard className="mt-3">
          {pairings.length === 0 && <EmptyRow>No pairing rules yet.</EmptyRow>}
          {pairings.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <span className="text-zinc-900 dark:text-white">
                {p.dependentTier.name} always needs &ge;{p.minRequiredCount} {p.requiredTier.name}
              </span>
              <TextButton tone="danger" onClick={() => deletePairing(p.id)}>
                Delete
              </TextButton>
            </div>
          ))}
        </ListCard>
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
        <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-white">
          Shift eligibility
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Which shifts each tier may work. Uncheck a shift to bar the tier from it (e.g.
          senior staff on mornings only); uncheck{" "}
          <span className="font-medium">Weekends</span> or{" "}
          <span className="font-medium">Holidays</span> to keep a tier off those days
          entirely.
        </p>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={theadRowClass}>
              <th className={`${thClass} px-5`}>Tier</th>
              {shifts.map((s) => (
                <th key={s.code} className={`${thClass} px-5`}>
                  {s.label}
                </th>
              ))}
              <th className={`${thClass} px-5`}>Weekends</th>
              <th className={`${thClass} px-5`}>Holidays</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => (
              <tr
                key={t.id}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/50"
              >
                <td className="px-5 py-3 font-medium text-zinc-900 dark:text-white">
                  {t.name}
                </td>
                {shifts.map((s) => (
                  <td key={s.code} className="px-5 py-3">
                    <Checkbox
                      checked={get(t.id, s.code).eligible}
                      onChange={(e) => set(t.id, s.code, { eligible: e.target.checked })}
                    />
                  </td>
                ))}
                <td className="px-5 py-3">
                  <Checkbox
                    checked={shifts.every((s) => get(t.id, s.code).weekendEligible)}
                    onChange={(e) =>
                      shifts.forEach((s) =>
                        set(t.id, s.code, { weekendEligible: e.target.checked }),
                      )
                    }
                  />
                </td>
                <td className="px-5 py-3">
                  <Checkbox
                    checked={shifts.every((s) => get(t.id, s.code).holidayEligible)}
                    onChange={(e) =>
                      shifts.forEach((s) =>
                        set(t.id, s.code, { holidayEligible: e.target.checked }),
                      )
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Button onClick={save} loading={saving}>
        {saving ? "Saving…" : "Save shift eligibility"}
      </Button>
    </div>
  );
}
