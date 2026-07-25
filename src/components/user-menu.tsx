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
    return <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />;
  }
  if (!session) {
    return (
      <Link
        href="/login"
        className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
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
        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white dark:border-slate-900 bg-gradient-to-tr from-indigo-500 to-purple-500 text-sm font-semibold text-white shadow-sm"
        title={session.user.email}
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-40 w-56 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
          <div className="border-b border-slate-100 dark:border-slate-800 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {session.user.name}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {session.user.email}
            </p>
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
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
            className="block w-full px-4 py-2.5 text-left text-sm text-rose-600 dark:text-rose-400 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
