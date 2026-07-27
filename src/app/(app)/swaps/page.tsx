"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";

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

const STATUS_STYLE: Record<string, string> = {
  PENDING_ACCEPT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  PENDING_APPROVAL: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  HARD_RULE_REJECTED: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  DECLINED: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  CANCELLED: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
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
    if (!rosterId) {
      setDetail(null);
      return;
    }
    api<RosterDetail>(`/api/rosters/${rosterId}`).then((d) => {
      setDetail(d);
      setOfferedStaff(d.staff[0]?.id ?? "");
    });
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

  if (loading) return <p className="text-slate-500 dark:text-slate-400">Loading…</p>;

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Shift swaps</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          One person offers a shift, another offers one back, and the exchange is checked
          against the same rules the roster was built with. Anything that would break a
          hard rule is turned away before it reaches you; the rest waits for your approval.
        </p>
      </div>

      <form
        onSubmit={raise}
        className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Offer a shift</h2>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Roster</span>
            <select
              required
              value={rosterId}
              onChange={(e) => setRosterId(e.target.value)}
              className="w-56 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="">Select…</option>
              {rosters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.ward.name} · {new Date(r.startDate).toLocaleDateString()} ({r.status.toLowerCase()})
                </option>
              ))}
            </select>
          </label>
          {detail && (
            <>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Who</span>
                <select
                  value={offeredStaff}
                  onChange={(e) => setOfferedStaff(e.target.value)}
                  className="w-48 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white"
                >
                  {detail.staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Day</span>
                <select
                  value={offeredDay}
                  onChange={(e) => setOfferedDay(Number(e.target.value))}
                  className="w-56 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white"
                >
                  {Array.from({ length: detail.days }, (_, d) => (
                    <option key={d} value={d}>
                      {dateOf(detail.startDate, d)} — {shiftName(cellOf(offeredStaff, d))}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Note</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="optional"
                  className="w-40 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white"
                />
              </label>
              <button className="rounded-xl bg-teal-600 px-5 py-2 font-medium text-white hover:bg-teal-700">
                Offer
              </button>
            </>
          )}
        </div>
      </form>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {notice && <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>}

      <div className="space-y-3">
        {swaps.length === 0 && (
          <p className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No swaps yet.
          </p>
        )}
        {swaps.map((s) => (
          <div
            key={s.id}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="text-sm">
                <p className="font-medium text-slate-900 dark:text-white">
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
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  <Link href={`/rosters/${s.roster.id}`} className="underline hover:text-slate-700 dark:hover:text-slate-300">
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
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status]}`}
              >
                {STATUS_LABEL[s.status] ?? s.status}
              </span>
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
                    <button
                      onClick={() => {
                        setAcceptingFor(s);
                        setAcceptStaff("");
                        setAcceptDay(0);
                      }}
                      className="rounded-lg bg-teal-600 px-3 py-1.5 font-medium text-white hover:bg-teal-700"
                    >
                      Offer a shift in exchange
                    </button>
                  )}
                  <button
                    onClick={() => act(s, "cancel")}
                    className="text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    Cancel
                  </button>
                </>
              )}
              {s.status === "PENDING_APPROVAL" && (
                <>
                  <button
                    onClick={() => act(s, "approve")}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700"
                  >
                    Approve and apply
                  </button>
                  <button
                    onClick={() => act(s, "decline")}
                    className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    Decline
                  </button>
                </>
              )}
            </div>
          </div>
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

  if (!roster) return <span className="text-slate-400">Loading roster…</span>;

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
        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-slate-900 dark:text-white"
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
        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-slate-900 dark:text-white"
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
      <span className="pb-1.5 text-slate-400">giving {label(cell)}</span>
      <button
        onClick={onSubmit}
        className="rounded-lg bg-teal-600 px-3 py-1.5 font-medium text-white hover:bg-teal-700"
      >
        Check and send
      </button>
      <button onClick={onCancel} className="pb-1.5 text-slate-400 hover:text-slate-600">
        Cancel
      </button>
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
