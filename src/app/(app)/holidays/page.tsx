"use client";

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
  TextButton,
} from "@/components/ui";

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

  if (loading) return <LoadingState label="Loading holidays…" />;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Public holidays"
        description={
          <>
            Holidays are treated separately from ordinary days: tiers can be kept off them
            entirely, and working them is balanced across staff over time rather than within
            a single roster. Add each year&apos;s date — instances sharing a name are linked,
            so &quot;who worked it last year&quot; is answerable.
          </>
        }
      />

      <Card className="p-4">
        <form onSubmit={add} className="flex flex-wrap items-end gap-3">
          <Field label="Date">
            <Input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Name">
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Christmas Day"
              className="w-56"
            />
          </Field>
          <Button type="submit">Add holiday</Button>
        </form>
      </Card>
      {error && <Alert tone="error">{error}</Alert>}

      <ListCard>
        {holidays.length === 0 && <EmptyRow>No public holidays recorded.</EmptyRow>}
        {holidays.map((h) => (
          <div key={h.id} className="flex items-center justify-between px-5 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium text-zinc-900 dark:text-white">
                {new Date(h.date).toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span className="text-zinc-600 dark:text-zinc-400">{h.name}</span>
              {(byGroup.get(h.groupKey)?.length ?? 0) > 1 && (
                <Badge tone="neutral" className="font-medium">
                  {byGroup.get(h.groupKey)!.length} years recorded
                </Badge>
              )}
            </div>
            <TextButton tone="danger" onClick={() => remove(h.id)}>
              Delete
            </TextButton>
          </div>
        ))}
      </ListCard>
    </div>
  );
}
