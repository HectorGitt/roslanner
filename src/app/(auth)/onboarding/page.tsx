"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

type Mode = "create" | "join";

export default function OnboardingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");
  const [hospitalName, setHospitalName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "create") {
        await api("/api/hospital", {
          method: "POST",
          body: JSON.stringify({ name: hospitalName }),
        });
      } else {
        await api("/api/hospital/join", {
          method: "POST",
          body: JSON.stringify({ inviteCode }),
        });
      }
      // Session cookie caches the user (without hospitalId) briefly — refresh it
      await authClient.getSession({ query: { disableCookieCache: true } });
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-white">One more step</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Your account isn&apos;t linked to a hospital yet. Create one or join your team.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-zinc-950/60 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`rounded-md py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
            mode === "create" ? "bg-emerald-500/20 text-emerald-300" : "text-zinc-400 hover:text-white"
          }`}
        >
          New hospital
        </button>
        <button
          type="button"
          onClick={() => setMode("join")}
          className={`rounded-md py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
            mode === "join" ? "bg-emerald-500/20 text-emerald-300" : "text-zinc-400 hover:text-white"
          }`}
        >
          Join with code
        </button>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        {mode === "create" ? (
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-zinc-300">Hospital name</span>
            <input
              required
              value={hospitalName}
              onChange={(e) => setHospitalName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2.5 text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              placeholder="St. Mary's Teaching Hospital"
            />
          </label>
        ) : (
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-zinc-300">Invite code</span>
            <input
              required
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="w-full rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2.5 font-mono tracking-widest text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              placeholder="XXXX-XXXX"
            />
          </label>
        )}

        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-emerald-700 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
        >
          {busy ? "Working…" : mode === "create" ? "Create hospital" : "Join hospital"}
        </button>
      </form>

      <button
        onClick={() => authClient.signOut().then(() => router.push("/login"))}
        className="mt-6 w-full text-center text-sm text-zinc-500 hover:text-zinc-300"
      >
        Sign out
      </button>
    </div>
  );
}
