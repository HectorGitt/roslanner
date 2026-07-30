"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { data, error } = await authClient.signIn.email({ email, password });
    if (error) {
      setError(error.message ?? "Sign in failed");
      setBusy(false);
      return;
    }
    const hospitalId = (data?.user as { hospitalId?: string | null })?.hospitalId;
    router.push(hospitalId ? "/dashboard" : "/onboarding");
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-white">Welcome back</h1>
      <p className="mt-1 text-sm text-zinc-400">Sign in to your hospital workspace.</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2.5 text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            placeholder="••••••••"
          />
        </label>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-emerald-700 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-400">
        No account?{" "}
        <Link href="/signup" className="font-medium text-emerald-400 hover:text-emerald-300">
          Create one
        </Link>
      </p>
    </div>
  );
}
