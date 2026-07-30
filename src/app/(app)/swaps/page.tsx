"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
  TextButton,
  inputSmClass,
} from "@/components/ui";

interface AssignmentRef {
  id: string;
  dayIndex: number;
  shift: string;
  staff: { id: string; name: string };
}
interface Swap {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
  roster: { id: string; startDate: string; days: number; ward: { id: string; name: string } };
  requestingAssignment: AssignmentRef;
  acceptingAssignment: AssignmentRef | null;
  proposedEvaluation: { blockedBy?: string[] } | null;
}
interface RosterRow {
  id: string;
  startDate: string;
  days: number;
  status: string;
  ward: { name: string };
}
interface RosterDetail {
  id: string;
  startDate: string;
  days: number;
  staff: { id: string; name: string; roleName: string }[];
  shiftDefs: { code: string; label: string }[];
  grid: string[][];
}

const STATUS_TONE: Record<string, "neutral" | "warning" | "danger" | "success"> = {
  PENDING_ACCEPT: "neutral",
  PENDING_APPROVAL: "warning",
  HARD_RULE_REJECTED: "danger",
  DECLINED: "neutral",
  APPROVED: "success",
  CANCELLED: "neutral",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING_ACCEPT: "waiting for an offer",
  PENDING_APPROVAL: "waiting for approval",
  HARD_RULE_REJECTED: "would break a rule",
  DECLINED: "declined",
  APPROVED: "approved",
  CANCELLED: "cancelled",
};

export default function SwapsPage() {
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [rosters, setRosters] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // New request
  const [rosterId, setRosterId] = useState("");
  const [detail, setDetail] = useState<RosterDetail | null>(null);
  const [offeredStaff, setOfferedStaff] = useState("");
  const [offeredDay, setOfferedDay] = useState(0);
  const [note, setNote] = useState("");

  // Accepting an offer
  const [acceptingFor, setAcceptingFor] = useState<Swap | null>(null);
  const [acceptStaff, setAcceptStaff] = useState("");
  const [acceptDay, setAcceptDay] = useState(0);

  const load = () =>
    Promise.all([api<Swap[]>("/api/swaps"), api<RosterRow[]>("/api/rosters")])
      .then(([s, r]) => {
        setSwaps(s);
        setRosters(r);
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!rosterId) {
      // Deferred rather than set synchronously, which would cascade a render.
      Promise.resolve().then(() => {
        if (!cancelled) setDetail(null);
      });
      return () => {
        cancelled = true;
      };
    }
    api<RosterDetail>(`/api/rosters/${rosterId}`)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setOfferedStaff(d.staff[0]?.id ?? "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [rosterId]);

  const dateOf = (start: string, dayIndex: number) => {
    const d = new Date(start + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + dayIndex);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  };
  const shiftName = (code: string) =>
    code === "DO" ? "off" : (detail?.shiftDefs.find((s) => s.code === code)?.label ?? code);

  /** What that person is doing on that day in the loaded roster. */
  const cellOf = (staffId: string, day: number) => {
    if (!detail) return "";
    const row = detail.staff.findIndex((s) => s.id === staffId);
    return row < 0 ? "" : detail.grid[row][day];
  };

  async function raise(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const rosterDetail = detail!;
      const res = await api<{ id: string }>("/api/rosters/" + rosterId);
      void res;
      // Find the assignment id by asking the roster for it.
      const assignmentId = await findAssignmentId(rosterId, offeredStaff, offeredDay);
      if (!assignmentId) {
        setError("That person has no assignment recorded on that day.");
        return;
      }
      await api("/api/swaps", {
        method: "POST",
        body: JSON.stringify({ rosterId: rosterDetail.id, offeredAssignmentId: assignmentId, note }),
      });
      setNote("");
      setNotice("Swap offered.");
      setTimeout(() => setNotice(""), 3000);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function accept(swap: Swap) {
    setError("");
    try {
      const assignmentId = await findAssignmentId(swap.roster.id, acceptStaff, acceptDay);
      if (!assignmentId) {
        setError("That person has no assignment recorded on that day.");
        return;
      }
      const res = await api<{ allowed: boolean; blockedBy: string[] }>(
        `/api/swaps/${swap.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ action: "accept", acceptingAssignmentId: assignmentId }),
        },
      );
      setNotice(
        res.allowed
          ? "Checked against the rules and sent for approval."
          : `Rejected: ${res.blockedBy.join("; ")}`,
      );
      setTimeout(() => setNotice(""), 6000);
      setAcceptingFor(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function act(swap: Swap, action: string) {
    setError("");
    try {
      await api(`/api/swaps/${swap.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      setNotice(action === "approve" ? "Swap approved and applied to the roster." : "Updated.");
      setTimeout(() => setNotice(""), 4000);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) return <LoadingState label="Loading swaps…" />;

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Shift swaps"
        description="One person offers a shift, another offers one back, and the exchange is checked against the same rules the roster was built with. Anything that would break a hard rule is turned away before it reaches you; the rest waits for your approval."
      />

      <Card className="p-5">
        <form onSubmit={raise} className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Offer a shift</h2>
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <Field label="Roster">
              <Select
                required
                value={rosterId}
                onChange={(e) => setRosterId(e.target.value)}
                className="w-56"
              >
                <option value="">Select…</option>
                {rosters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.ward.name} · {new Date(r.startDate).toLocaleDateString()} ({r.status.toLowerCase()})
                  </option>
                ))}
              </Select>
            </Field>
            {detail && (
              <>
                <Field label="Who">
                  <Select
                    value={offeredStaff}
                    onChange={(e) => setOfferedStaff(e.target.value)}
                    className="w-48"
                  >
                    {detail.staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Day">
                  <Select
                    value={offeredDay}
                    onChange={(e) => setOfferedDay(Number(e.target.value))}
                    className="w-56"
                  >
                    {Array.from({ length: detail.days }, (_, d) => (
                      <option key={d} value={d}>
                        {dateOf(detail.startDate, d)} — {shiftName(cellOf(offeredStaff, d))}
                      </option>
                    ))}
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
                <Button type="submit">Offer</Button>
              </>
            )}
          </div>
        </form>
      </Card>

      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <div className="space-y-3">
        {swaps.length === 0 && (
          <Card>
            <p className="px-5 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No swaps yet.
            </p>
          </Card>
        )}
        {swaps.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="text-sm">
                <p className="font-medium text-zinc-900 dark:text-white">
                  {s.requestingAssignment.staff.name} offers{" "}
                  {dateOf(s.roster.startDate, s.requestingAssignment.dayIndex)} (
                  {s.requestingAssignment.shift === "DO" ? "off" : s.requestingAssignment.shift})
                  {s.acceptingAssignment && (
                    <>
                      {" ⇄ "}
                      {s.acceptingAssignment.staff.name}{" "}
                      {dateOf(s.roster.startDate, s.acceptingAssignment.dayIndex)} (
                      {s.acceptingAssignment.shift === "DO" ? "off" : s.acceptingAssignment.shift})
                    </>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <Link
                    href={`/rosters/${s.roster.id}`}
                    className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    {s.roster.ward.name}
                  </Link>
                  {s.note ? ` · ${s.note}` : ""}
                </p>
                {s.proposedEvaluation?.blockedBy?.length ? (
                  <ul className="mt-1.5 space-y-0.5 text-xs text-rose-600 dark:text-rose-400">
                    {s.proposedEvaluation.blockedBy.map((m, i) => (
                      <li key={i}>• {m}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <Badge tone={STATUS_TONE[s.status] ?? "neutral"} className="shrink-0 font-medium">
                {STATUS_LABEL[s.status] ?? s.status}
              </Badge>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-3 text-xs">
              {s.status === "PENDING_ACCEPT" && (
                <>
                  {acceptingFor?.id === s.id ? (
                    <AcceptForm
                      swap={s}
                      onCancel={() => setAcceptingFor(null)}
                      onSubmit={() => accept(s)}
                      staffId={acceptStaff}
                      setStaffId={setAcceptStaff}
                      day={acceptDay}
                      setDay={setAcceptDay}
                    />
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        setAcceptingFor(s);
                        setAcceptStaff("");
                        setAcceptDay(0);
                      }}
                    >
                      Offer a shift in exchange
                    </Button>
                  )}
                  <TextButton tone="danger" onClick={() => act(s, "cancel")}>
                    Cancel
                  </TextButton>
                </>
              )}
              {s.status === "PENDING_APPROVAL" && (
                <>
                  <Button size="sm" variant="success" onClick={() => act(s, "approve")}>
                    Approve and apply
                  </Button>
                  <TextButton onClick={() => act(s, "decline")}>Decline</TextButton>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/** Pick the shift being offered back, by person and day. */
function AcceptForm({
  swap,
  onCancel,
  onSubmit,
  staffId,
  setStaffId,
  day,
  setDay,
}: {
  swap: Swap;
  onCancel: () => void;
  onSubmit: () => void;
  staffId: string;
  setStaffId: (v: string) => void;
  day: number;
  setDay: (v: number) => void;
}) {
  const [roster, setRoster] = useState<RosterDetail | null>(null);
  useEffect(() => {
    api<RosterDetail>(`/api/rosters/${swap.roster.id}`).then((d) => {
      setRoster(d);
      if (!staffId) setStaffId(d.staff[0]?.id ?? "");
    });
    // Runs once per swap; staffId is only read to avoid clobbering a choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swap.roster.id]);

  if (!roster) return <span className="text-zinc-400">Loading roster…</span>;

  const rowOf = roster.staff.findIndex((s) => s.id === staffId);
  const cell = rowOf < 0 ? "" : roster.grid[rowOf][day];
  const label = (code: string) =>
    code === "DO" ? "off" : (roster.shiftDefs.find((s) => s.code === code)?.label ?? code);
  const dateOf = (dayIndex: number) => {
    const d = new Date(roster.startDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + dayIndex);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <select
        value={staffId}
        onChange={(e) => setStaffId(e.target.value)}
        className={inputSmClass}
      >
        {roster.staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <select
        value={day}
        onChange={(e) => setDay(Number(e.target.value))}
        className={inputSmClass}
      >
        {Array.from({ length: roster.days }, (_, d) => {
          const c = rowOf < 0 ? "" : roster.grid[rowOf][d];
          return (
            <option key={d} value={d}>
              {dateOf(d)} — {label(c)}
            </option>
          );
        })}
      </select>
      <span className="pb-1.5 text-zinc-400">giving {label(cell)}</span>
      <Button size="sm" onClick={onSubmit}>
        Check and send
      </Button>
      <TextButton onClick={onCancel} className="pb-1.5">
        Cancel
      </TextButton>
    </div>
  );
}

/** The roster's assignment id for one person on one day. */
async function findAssignmentId(
  rosterId: string,
  staffId: string,
  dayIndex: number,
): Promise<string | null> {
  const rows = await api<{ id: string; staffId: string; dayIndex: number }[]>(
    `/api/rosters/${rosterId}/assignments`,
  );
  return rows.find((a) => a.staffId === staffId && a.dayIndex === dayIndex)?.id ?? null;
}
