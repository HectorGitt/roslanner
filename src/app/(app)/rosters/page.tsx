"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
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
  PageHeader,
  Select,
  TextButton,
} from "@/components/ui";

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

  if (loading) return <LoadingState label="Loading rosters…" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rosters"
        description="Generate a roster for a ward — the solver fills coverage while respecting rest rules, leave and fairness."
      />

      <Card className="p-5">
        <form onSubmit={generate} className="flex flex-wrap items-end gap-4">
          <Field label="Ward">
            <Select
              required
              value={wardId}
              onChange={(e) => {
                setWardId(e.target.value);
                // Adopt the ward's own cycle length as the starting period.
                const w = wards.find((x) => x.id === e.target.value);
                if (w) setDays(w.cycleLengthDays);
              }}
              className="w-52"
            >
              <option value="">Select…</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          {groups.length > 0 && (
            <Field label="Covers">
              <Select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-44"
              >
                <option value="">Everyone on the ward</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Start date">
            <Input
              required
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="Days">
            <Input
              type="number"
              min={1}
              max={62}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-24"
            />
          </Field>
          <Button type="submit" loading={generating}>
            {generating ? "Solving…" : "Generate roster"}
          </Button>
        </form>
      </Card>
      {error && <Alert tone="error">{error}</Alert>}

      <ListCard>
        {rosters.length === 0 && <EmptyRow>No rosters yet.</EmptyRow>}
        {rosters.map((r) => (
          <div
            key={r.id}
            className="group flex items-center justify-between px-5 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          >
            <Link
              href={`/rosters/${r.id}`}
              className="flex-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 hover:text-emerald-700 dark:hover:text-emerald-400"
            >
              <span className="font-semibold text-zinc-900 dark:text-white">{r.ward.name}</span>
              {r.group && (
                <Badge tone="neutral" className="ml-2 font-medium">
                  {r.group.name}
                </Badge>
              )}
              <span className="ml-3 text-sm text-zinc-500 dark:text-zinc-400">
                {/* Calendar dates are stored as UTC midnight; render them as such
                    or they show a day early west of UTC. */}
                {new Date(r.startDate).toLocaleDateString(undefined, { timeZone: "UTC" })}{" "}
                <span className="mx-1">&middot;</span> {r.days} days
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Badge tone={r.status === "PUBLISHED" ? "success" : "warning"} className="tracking-wide">
                {r.status}
              </Badge>
              <TextButton
                tone="danger"
                onClick={() => remove(r.id)}
                className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
              >
                Delete
              </TextButton>
            </div>
          </div>
        ))}
      </ListCard>
    </div>
  );
}
