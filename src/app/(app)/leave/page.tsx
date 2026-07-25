"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";

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

  if (loading) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Leave & day-off requests</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          <span className="font-medium text-slate-700 dark:text-slate-300">Approved leave</span> is a hard constraint — the
          solver will never schedule over it.{" "}
          <span className="font-medium text-slate-700 dark:text-slate-300">Day-off requests</span> are honoured when possible.
        </p>
      </div>

      <form
        onSubmit={add}
        className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
      >
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">Staff</span>
          <select
            required
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="w-56 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-slate-900 dark:text-white outline-none focus:border-teal-500 shadow-sm"
          >
            <option value="">Select…</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.role.name} ({s.ward.name})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">From</span>
          <input
            required
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-slate-900 dark:text-white outline-none focus:border-teal-500 shadow-sm [color-scheme:light] dark:[color-scheme:dark]"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">To</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-slate-900 dark:text-white outline-none focus:border-teal-500 shadow-sm [color-scheme:light] dark:[color-scheme:dark]"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-slate-900 dark:text-white outline-none focus:border-teal-500 shadow-sm"
          >
            <option value="LEAVE">Approved leave (hard)</option>
            <option value="DAY_OFF_REQUEST">Day-off request (soft)</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">Note</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="optional"
            className="w-40 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-slate-900 dark:text-white outline-none focus:border-teal-500 shadow-sm"
          />
        </label>
        <button className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700 shadow-sm shadow-teal-600/20 transition-all">
          Add
        </button>
      </form>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        {leave.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No leave recorded.</p>
        )}
        {leave.map((l) => (
          <div
            key={l.id}
            className="group flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 px-5 py-4 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium text-slate-900 dark:text-white">{l.staff.name}</span>
              <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400">{l.staff.role.name}</span>
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                {new Date(l.startDate).toLocaleDateString()} <span className="text-slate-300 dark:text-slate-600 mx-1">&rarr;</span>{" "}
                {new Date(l.endDate).toLocaleDateString()}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  l.type === "LEAVE"
                    ? "bg-rose-100/80 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
                    : "bg-sky-100/80 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400"
                }`}
              >
                {l.type === "LEAVE" ? "Leave" : "DO request"}
              </span>
              {l.note && <span className="text-xs italic text-slate-400 dark:text-slate-500 border-l border-slate-200 dark:border-slate-700 pl-3">{l.note}</span>}
            </div>
            <button
              onClick={() => remove(l.id)}
              className="text-xs font-medium text-slate-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
