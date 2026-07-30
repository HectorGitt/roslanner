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
  Select,
  TextButton,
} from "@/components/ui";

interface StaffRow {
  id: string;
  name: string;
  role: { name: string };
  ward: { id: string; name: string };
}
interface LeaveRow {
  id: string;
  startDate: string;
  endDate: string;
  type: string;
  note: string | null;
  staff: { id: string; name: string; role: { name: string } };
}

export default function LeavePage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [leave, setLeave] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [staffId, setStaffId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [type, setType] = useState("LEAVE");
  const [note, setNote] = useState("");

  const load = () =>
    Promise.all([api<StaffRow[]>("/api/staff"), api<LeaveRow[]>("/api/leave")])
      .then(([s, l]) => {
        setStaff(s);
        setLeave(l);
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/leave", {
        method: "POST",
        body: JSON.stringify({
          staffId,
          startDate,
          endDate: endDate || startDate,
          type,
          note,
        }),
      });
      setStartDate("");
      setEndDate("");
      setNote("");
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(id: string) {
    await api(`/api/leave/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <LoadingState label="Loading leave…" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave & day-off requests"
        description={
          <>
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Approved leave</span> is a hard
            constraint — the solver will never schedule over it.{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Day-off requests</span> are honoured
            when possible.
          </>
        }
      />

      <Card className="p-5">
        <form onSubmit={add} className="flex flex-wrap items-end gap-4">
          <Field label="Staff">
            <Select
              required
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="w-56"
            >
              <option value="">Select…</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.role.name} ({s.ward.name})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From">
            <Input
              required
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="To">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="LEAVE">Approved leave (hard)</option>
              <option value="DAY_OFF_REQUEST">Day-off request (soft)</option>
            </Select>
          </Field>
          <Field label="Note">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="optional"
              className="w-40"
            />
          </Field>
          <Button type="submit">Add</Button>
        </form>
      </Card>
      {error && <Alert tone="error">{error}</Alert>}

      <ListCard>
        {leave.length === 0 && <EmptyRow>No leave recorded.</EmptyRow>}
        {leave.map((l) => (
          <div
            key={l.id}
            className="group flex items-center justify-between px-5 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          >
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium text-zinc-900 dark:text-white">{l.staff.name}</span>
              <Badge tone="neutral" className="font-medium">{l.staff.role.name}</Badge>
              <span className="font-medium text-zinc-500 dark:text-zinc-400">
                {new Date(l.startDate).toLocaleDateString()}{" "}
                <span className="mx-1 text-zinc-300 dark:text-zinc-600">&rarr;</span>{" "}
                {new Date(l.endDate).toLocaleDateString()}
              </span>
              <Badge tone={l.type === "LEAVE" ? "danger" : "info"}>
                {l.type === "LEAVE" ? "Leave" : "DO request"}
              </Badge>
              {l.note && (
                <span className="border-l border-zinc-200 pl-3 text-xs italic text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
                  {l.note}
                </span>
              )}
            </div>
            <TextButton
              tone="danger"
              onClick={() => remove(l.id)}
              className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
            >
              Delete
            </TextButton>
          </div>
        ))}
      </ListCard>
    </div>
  );
}
