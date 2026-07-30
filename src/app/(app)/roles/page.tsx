"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Alert,
  Button,
  EmptyRow,
  Input,
  ListCard,
  LoadingState,
  PageHeader,
  TextButton,
  inputSmClass,
} from "@/components/ui";

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
      <PageHeader
        title="Roles & staff groups"
        description={
          <>
            Roles are what people do — Doctor, Nurse, Cleaner. A group is a body of staff
            rostered <em>separately</em> from the rest of the ward, because their rules differ.
          </>
        }
      />

      {error && <Alert tone="error">{error}</Alert>}

      {loading ? (
        <LoadingState label="Loading roles…" />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Roles
            </h2>

            <form onSubmit={createRole} className="flex gap-2">
              <label className="sr-only" htmlFor="role-name">
                Role name
              </label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Doctor"
                className="w-64"
              />
              <Button type="submit">Add role</Button>
            </form>

            <ListCard>
              {roles.length === 0 && <EmptyRow>No roles yet.</EmptyRow>}
              {roles.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <div>
                    <span className="font-medium text-zinc-900 dark:text-white">{r.name}</span>
                    <span className="ml-3 text-xs text-zinc-500 dark:text-zinc-400">
                      {r._count.staff} staff
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      Rostered with
                      <select
                        value={r.groupId ?? ""}
                        onChange={(e) => setRoleGroup(r.id, e.target.value)}
                        className={`${inputSmClass} text-xs`}
                      >
                        <option value="">the whole ward</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <TextButton tone="danger" onClick={() => deleteRole(r.id)}>
                      Delete
                    </TextButton>
                  </div>
                </div>
              ))}
            </ListCard>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Staff groups
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Create a group when one body of staff needs its own shifts or rules —
              doctors on day and call duty while nurses run three shifts on the same
              ward. Each group is then rostered on its own. A group that defines no
              shifts, coverage or rules of its own simply uses the ward&apos;s.
            </p>

            <form onSubmit={createGroup} className="flex gap-2">
              <label className="sr-only" htmlFor="group-name">
                Group name
              </label>
              <Input
                id="group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Nursing"
                className="w-64"
              />
              <Button type="submit" variant="secondary">
                Add group
              </Button>
            </form>

            <ListCard>
              {groups.length === 0 && (
                <EmptyRow>
                  No groups — every roster covers the whole ward at once, which is fine until
                  two kinds of staff need different rules.
                </EmptyRow>
              )}
              {groups.map((g) => (
                <div
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div>
                    <span className="font-medium text-zinc-900 dark:text-white">{g.name}</span>
                    <span className="ml-3 text-xs text-zinc-500 dark:text-zinc-400">
                      {g.roles.length === 0
                        ? "no roles yet"
                        : g.roles.map((r) => r.name).join(", ")}
                      {g._count.rosters > 0 &&
                        ` · ${g._count.rosters} roster${g._count.rosters === 1 ? "" : "s"}`}
                    </span>
                  </div>
                  <TextButton tone="danger" onClick={() => deleteGroup(g.id, g.name)}>
                    Delete
                  </TextButton>
                </div>
              ))}
            </ListCard>

            {groups.length > 0 && ungrouped.length > 0 && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Not in any group: {ungrouped.map((r) => r.name).join(", ")} — these appear only
                in whole-ward rosters.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
