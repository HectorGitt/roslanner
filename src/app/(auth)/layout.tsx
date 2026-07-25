import Link from "next/link";
import React from "react";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 selection:bg-teal-500/30">
      {/* Background orbs to match the landing page */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] h-[50%] w-[50%] rounded-full bg-teal-900/20 blur-[120px]" />
        <div className="absolute right-[-10%] top-[20%] h-[60%] w-[40%] rounded-full bg-emerald-900/20 blur-[120px]" />
      </div>

      <Link href="/" className="relative z-10 mb-8 flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-white shadow-lg shadow-teal-500/20">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <span className="text-xl font-bold tracking-tight text-white">
          Ros<span className="text-teal-400">lanner</span>
        </span>
      </Link>

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl backdrop-blur-xl">
        {children}
      </div>
    </div>
  );
}
