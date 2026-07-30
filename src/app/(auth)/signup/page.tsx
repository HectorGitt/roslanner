"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

type Mode = "create" | "join";

export default function SignupPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);

    const { error: signUpError } = await authClient.signUp.email({
      name,
      email,
      password,
    });
    if (signUpError) {
      setError(signUpError.message ?? "Sign up failed");
      setBusy(false);
      return;
    }

    // Attach to a hospital; if this fails the user finishes on /onboarding
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
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
      router.push("/onboarding");
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-white">Create your account</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Start a hospital workspace or join your team with an invite code.
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
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-zinc-300">Your name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2.5 text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            placeholder="Dr. Olaitan"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-zinc-300">Email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2.5 text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            placeholder="you@hospital.org"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-zinc-300">Password</span>
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2.5 text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            placeholder="At least 8 characters"
          />
        </label>

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
          {busy
            ? "Creating account…"
            : mode === "create"
              ? "Create account & hospital"
              : "Create account & join"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-emerald-400 hover:text-emerald-300">
          Sign in
        </Link>
      </p>
    </div>
  );
}
