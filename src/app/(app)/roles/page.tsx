"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface RoleRow {
  id: string;
  name: string;
  _count: { staff: number };
}

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () =>
    api<RoleRow[]>("/api/roles")
      .then(setRoles)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function createRole(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/roles", { method: "POST", body: JSON.stringify({ name }) });
      setName("");
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function deleteRole(id: string) {
    setError("");
    try {
      await api(`/api/roles/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Roles</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Staff types used for coverage requirements — e.g. Doctor, Nurse, Midwife, Pharmacist.
        </p>
      </div>

      <form onSubmit={createRole} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Doctor"
          className="w-64 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500 dark:focus:border-teal-500 shadow-sm"
        />
        <button className="rounded-xl bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700 shadow-sm shadow-teal-600/20 transition-all">
          Add role
        </button>
      </form>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-slate-500 dark:text-slate-400">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          {roles.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No roles yet.</p>
          )}
          {roles.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 px-5 py-4 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div>
                <span className="font-medium text-slate-900 dark:text-white">{r.name}</span>
                <span className="ml-3 text-xs text-slate-500 dark:text-slate-400">
                  {r._count.staff} staff
                </span>
              </div>
              <button
                onClick={() => deleteRole(r.id)}
                className="text-xs font-medium text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
