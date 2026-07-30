"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
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
    <div className="space-y-6">
      <PageHeader
        title="Wards"
        description="Each ward has its own staff, coverage requirements and rules."
      />

      <Card className="p-5">
        <form onSubmit={createWard} className="space-y-2">
          <div className="flex flex-wrap gap-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Paediatrics, ICU, Surgical Ward A"
              className="w-80"
            />
            <Select value={preset} onChange={(e) => setPreset(e.target.value)}>
              {presets.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.category}
                </option>
              ))}
            </Select>
            <Button type="submit">Add ward</Button>
          </div>
          {chosen && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {chosen.description} — {chosen.shifts.map((s) => s.label).join(", ")} ·{" "}
              {chosen.cycleLengthDays}-day cycle. All editable afterwards.
            </p>
          )}
        </form>
      </Card>
      {error && <Alert tone="error">{error}</Alert>}

      {loading ? (
        <LoadingState label="Loading wards…" />
      ) : wards.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
          title="No wards yet"
          description="Create your first ward above — pick a preset to start with sensible shifts, then fine-tune everything."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {wards.map((w) => (
            <Card
              key={w.id}
              className="group p-5 transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-500/5 dark:hover:border-emerald-900/50"
            >
              <div className="flex items-start justify-between">
                <Link
                  href={`/wards/${w.id}`}
                  className="rounded text-lg font-semibold text-zinc-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 group-hover:text-emerald-600 dark:text-white dark:group-hover:text-emerald-400"
                >
                  {w.name}
                </Link>
                <TextButton
                  tone="danger"
                  onClick={() => deleteWard(w.id, w.name)}
                  className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
                >
                  Delete
                </TextButton>
              </div>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {w._count.staff} staff · {w._count.rosters} roster{w._count.rosters === 1 ? "" : "s"}
              </p>
              <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                {w.category} · {w.cycleLengthDays}-day cycle
              </p>
              <ButtonLink href={`/wards/${w.id}`} variant="secondary" size="sm" className="mt-4">
                Configure <span aria-hidden="true">&rarr;</span>
              </ButtonLink>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
