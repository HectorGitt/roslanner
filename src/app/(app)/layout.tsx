"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { UserMenu } from "@/components/user-menu";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/wards", label: "Wards" },
  { href: "/roles", label: "Roles" },
  { href: "/tiers", label: "Tiers" },
  { href: "/leave", label: "Leave" },
  { href: "/holidays", label: "Holidays" },
  { href: "/rosters", label: "Rosters" },
  { href: "/swaps", label: "Swaps" },
];

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50 dark:bg-slate-950">
      <header className="sticky top-0 z-30 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3 w-full">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-sm text-white shadow-lg shadow-teal-500/20 group-hover:shadow-teal-500/40 transition-all duration-300">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <span className="font-bold text-slate-900 dark:text-white tracking-tight">Ros<span className="text-teal-600 dark:text-teal-400">lanner</span></span>
            </Link>
            <nav className="hidden md:flex gap-1.5 text-sm font-medium">
              {NAV.map((n) => {
                const isActive = pathname === n.href || pathname.startsWith(`${n.href}/`);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`rounded-lg px-3 py-2 transition-all ${
                      isActive
                        ? "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
