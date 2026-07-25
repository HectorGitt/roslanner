"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

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

  if (error) return <p className="text-rose-600 dark:text-rose-400">{error}</p>;
  if (!hospital) return <p className="text-slate-500">Loading…</p>;

  async function copyCode() {
    await navigator.clipboard.writeText(hospital!.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Hospital settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Workspace details and team access.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Workspace
        </h2>
        <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
          {hospital.name}
        </p>

        <div className="mt-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Invite code</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Share this with colleagues — they can join your hospital when signing up.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-2 font-mono text-lg tracking-widest text-teal-700 dark:text-teal-400">
              {hospital.inviteCode}
            </code>
            <button
              onClick={copyCode}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Members ({hospital.users.length})
        </h2>
        <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          {hospital.users.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{m.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{m.email}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  m.role === "ADMIN"
                    ? "bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {m.role.toLowerCase()}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
