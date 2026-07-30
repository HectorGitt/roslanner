"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Alert, Badge, Button, Card, LoadingState, PageHeader } from "@/components/ui";

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}
interface Hospital {
  id: string;
  name: string;
  inviteCode: string;
  users: Member[];
}

export default function SettingsPage() {
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api<Hospital>("/api/hospital")
      .then(setHospital)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!hospital) return <LoadingState label="Loading settings…" />;

  async function copyCode() {
    await navigator.clipboard.writeText(hospital!.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Hospital settings" description="Workspace details and team access." />

      <Card className="p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Workspace
        </h2>
        <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-white">
          {hospital.name}
        </p>

        <div className="mt-4">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Invite code</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Share this with colleagues — they can join your hospital when signing up.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 font-mono text-lg tracking-widest text-emerald-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-emerald-400">
              {hospital.inviteCode}
            </code>
            <Button variant="secondary" onClick={copyCode}>
              {copied ? "Copied ✓" : "Copy"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Members ({hospital.users.length})
        </h2>
        <div className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
          {hospital.users.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-zinc-900 dark:text-white">{m.name}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{m.email}</p>
              </div>
              <Badge tone={m.role === "ADMIN" ? "brand" : "neutral"} className="font-medium">
                {m.role.toLowerCase()}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
