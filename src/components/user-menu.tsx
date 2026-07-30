"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient, useSession } from "@/lib/auth-client";

export function UserMenu() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (isPending) {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />;
  }
  if (!session) {
    return (
      <Link
        href="/login"
        className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
      >
        Sign in
      </Link>
    );
  }

  const initial = (session.user.name || session.user.email)[0]?.toUpperCase() ?? "?";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white dark:border-zinc-900 bg-emerald-700 text-sm font-semibold text-white shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        title={session.user.email}
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-40 w-56 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl shadow-zinc-900/10 dark:shadow-black/40">
          <div className="border-b border-zinc-100 dark:border-zinc-800 px-4 py-3">
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
              {session.user.name}
            </p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {session.user.email}
            </p>
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Hospital settings
          </Link>
          <button
            onClick={() =>
              authClient.signOut().then(() => {
                router.push("/login");
                router.refresh();
              })
            }
            className="block w-full px-4 py-2.5 text-left text-sm text-rose-600 dark:text-rose-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
