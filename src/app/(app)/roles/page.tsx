"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface GroupRow {
  id: string;
  name: string;
  sortOrder: number;
  roles: { id: string; name: string }[];
  _count: { rosters: number };
}

interface RoleRow {
  id: string;
  name: string;
  groupId: string | null;
  group: { id: string; name: string } | null;
  _count: { staff: number };
}

const inputClass =
  "rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500 shadow-sm";

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [name, setName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    () =>
      Promise.all([api<RoleRow[]>("/api/roles"), api<GroupRow[]>("/api/groups")])
        .then(([r, g]) => {
          setRoles(r);
          setGroups(g);
        })
        .catch((e) => setError((e as Error).message))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

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

  async function setRoleGroup(id: string, groupId: string) {
    setError("");
    try {
      await api(`/api/roles/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ groupId: groupId || null }),
      });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function createGroup(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/groups", {
        method: "POST",
        body: JSON.stringify({ name: groupName, sortOrder: groups.length }),
      });
      setGroupName("");
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function deleteGroup(id: string, label: string) {
    if (!confirm(`Delete the "${label}" group? Its roles stay, just untagged.`)) return;
    setError("");
    try {
      await api(`/api/groups/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const ungrouped = roles.filter((r) => !r.groupId);

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Roles &amp; staff groups
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Roles are what people do — Doctor, Nurse, Cleaner. A group is a body of
          staff rostered <em>separately</em> from the rest of the ward, because
          their rules differ.
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-slate-500 dark:text-slate-400">Loading…</p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Roles
            </h2>

            <form onSubmit={createRole} className="flex gap-2">
              <label className="sr-only" htmlFor="role-name">
                Role name
              </label>
              <input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Doctor"
                className={`w-64 ${inputClass}`}
              />
              <button className="rounded-xl bg-teal-600 px-5 py-2 text-sm font-medium text-white shadow-sm shadow-teal-600/20 transition-all hover:bg-teal-700">
                Add role
              </button>
            </form>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              {roles.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  No roles yet.
                </p>
              )}
              {roles.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 transition-colors last:border-0 hover:bg-slate-50 dark:border-slate-800/50 dark:hover:bg-slate-800/50"
                >
                  <div>
                    <span className="font-medium text-slate-900 dark:text-white">{r.name}</span>
                    <span className="ml-3 text-xs text-slate-500 dark:text-slate-400">
                      {r._count.staff} staff
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      Rostered with
                      <select
                        value={r.groupId ?? ""}
                        onChange={(e) => setRoleGroup(r.id, e.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      >
                        <option value="">the whole ward</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      onClick={() => deleteRole(r.id)}
                      className="text-xs font-medium text-slate-400 transition-colors hover:text-red-600 dark:hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Staff groups
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Create a group when one body of staff needs its own shifts or rules —
              doctors on day and call duty while nurses run three shifts on the same
              ward. Each group is then rostered on its own. A group that defines no
              shifts, coverage or rules of its own simply uses the ward&apos;s.
            </p>

            <form onSubmit={createGroup} className="flex gap-2">
              <label className="sr-only" htmlFor="group-name">
                Group name
              </label>
              <input
                id="group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Nursing"
                className={`w-64 ${inputClass}`}
              />
              <button className="rounded-xl border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                Add group
              </button>
            </form>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              {groups.length === 0 && (
                <p className="px-5 py-8 text-sm text-slate-500 dark:text-slate-400">
                  No groups — every roster covers the whole ward at once, which is
                  fine until two kinds of staff need different rules.
                </p>
              )}
              {groups.map((g) => (
                <div
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 last:border-0 dark:border-slate-800/50"
                >
                  <div>
                    <span className="font-medium text-slate-900 dark:text-white">{g.name}</span>
                    <span className="ml-3 text-xs text-slate-500 dark:text-slate-400">
                      {g.roles.length === 0
                        ? "no roles yet"
                        : g.roles.map((r) => r.name).join(", ")}
                      {g._count.rosters > 0 &&
                        ` · ${g._count.rosters} roster${g._count.rosters === 1 ? "" : "s"}`}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteGroup(g.id, g.name)}
                    className="text-xs font-medium text-slate-400 transition-colors hover:text-red-600 dark:hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>

            {groups.length > 0 && ungrouped.length > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Not in any group: {ungrouped.map((r) => r.name).join(", ")} — these
                appear only in whole-ward rosters.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
