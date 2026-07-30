import Link from "next/link";
import React from "react";

/* Deterministic mock roster for the hero board — no randomness so SSR and
   hydration render identically. Codes: M morning, E evening, N night, – off. */
const MOCK_STAFF = [
  { name: "A. Okafor", role: "Consultant", cells: ["M", "M", "-", "E", "E", "-", "M"] },
  { name: "T. Hassan", role: "Registrar", cells: ["E", "-", "M", "M", "-", "N", "N"] },
  { name: "J. Mensah", role: "Nurse", cells: ["N", "N", "-", "-", "M", "M", "E"] },
  { name: "R. Adeyemi", role: "Nurse", cells: ["-", "E", "E", "N", "N", "-", "-"] },
  { name: "S. Bello", role: "Intern", cells: ["M", "M", "E", "-", "M", "E", "-"] },
];

const CELL_STYLE: Record<string, string> = {
  M: "bg-amber-100 text-amber-700 ring-amber-200",
  E: "bg-sky-100 text-sky-700 ring-sky-200",
  N: "bg-indigo-600 text-white ring-indigo-500",
  "-": "bg-zinc-100 text-zinc-400 ring-zinc-200",
};

const CHECK = (
  <svg className="h-5 w-5 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-md shadow-emerald-500/30">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </span>
      <span className="text-lg font-bold tracking-tight">
        Ros<span className="text-emerald-600">lanner</span>
      </span>
    </span>
  );
}

export default function LandingPage() {
  return (
    <div className="relative overflow-x-clip">
      {/* Backdrop: soft radial glow + dot grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[900px] bg-[radial-gradient(60%_50%_at_50%_0%,rgba(5,150,105,0.08),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[900px] bg-[radial-gradient(rgba(24,24,27,0.06)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />

      {/* Floating pill nav */}
      <header className="fixed inset-x-0 top-4 z-50 px-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between rounded-full border border-zinc-200/80 bg-white/85 py-2 pl-4 pr-2 shadow-lg shadow-zinc-900/5 backdrop-blur-xl">
          <Link href="/" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
            <Wordmark />
          </Link>
          <nav className="hidden items-center gap-1 text-sm font-medium text-zinc-600 md:flex">
            {[
              ["#product", "Product"],
              ["#how", "How it works"],
              ["#pricing", "Pricing"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-3 py-1.5 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <Link
              href="/login"
              className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto grid w-full max-w-7xl items-center gap-14 px-6 pb-24 pt-36 lg:grid-cols-2 lg:gap-8 lg:pt-44">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Roster planning for hospitals
          </p>
          <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tighter text-zinc-900 sm:text-6xl xl:text-7xl">
            The ward roster,{" "}
            <span className="text-emerald-700">
              solved.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-600">
            Describe your coverage, rest rules and leave once. Roslanner&apos;s constraint
            engine turns them into a fair, compliant schedule in seconds — and checks every
            manual tweak live.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-7 py-3.5 text-base font-semibold text-white shadow-xl shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2"
            >
              Build your first roster
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-2xl border border-zinc-300 bg-white px-7 py-3.5 text-base font-medium text-zinc-800 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            >
              See how it works
            </a>
          </div>
          <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-500">
            <span className="flex items-center gap-1.5">{CHECK} Free to start</span>
            <span className="flex items-center gap-1.5">{CHECK} No credit card</span>
            <span className="flex items-center gap-1.5">{CHECK} Set up in minutes</span>
          </p>
        </div>

        {/* Mock roster board */}
        <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
          <div className="rotate-1 rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xl shadow-zinc-900/10 transition-transform duration-500 hover:rotate-0">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-zinc-900">ICU — Week 32</p>
                <p className="text-xs text-zinc-500">7 days · 5 staff · 3 shifts</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                Published
              </span>
            </div>
            <div className="space-y-1.5">
              {MOCK_STAFF.map((s) => (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="w-24 shrink-0">
                    <p className="truncate text-xs font-semibold text-zinc-800">{s.name}</p>
                    <p className="truncate text-[10px] text-zinc-400">{s.role}</p>
                  </div>
                  <div className="grid flex-1 grid-cols-7 gap-1">
                    {s.cells.map((c, i) => (
                      <span
                        key={i}
                        className={`flex h-8 items-center justify-center rounded-md text-[11px] font-bold ring-1 ring-inset ${CELL_STYLE[c]}`}
                      >
                        {c === "-" ? "·" : c}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3 border-t border-zinc-100 pt-3 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-amber-300" /> Morning</span>
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-sky-300" /> Evening</span>
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-indigo-600" /> Night</span>
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-zinc-200" /> Off</span>
            </div>
          </div>

          {/* Floating status cards */}
          <div className="absolute -left-4 -top-6 -rotate-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-xl shadow-zinc-900/10 sm:-left-8">
            <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </span>
              0 hard violations
            </p>
          </div>
          <div className="absolute -bottom-6 -right-2 rotate-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-xl shadow-zinc-900/10 sm:-right-6">
            <p className="text-xs text-zinc-500">Fairness spread</p>
            <p className="text-sm font-bold text-zinc-900">
              1.2 <span className="font-semibold text-emerald-600">· evenly shared</span>
            </p>
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="reveal border-y border-zinc-200 bg-zinc-50">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-y-10 px-6 py-14 text-center md:grid-cols-4">
          {[
            ["100+", "Hospitals utilizing Roslanner"],
            ["98%", "Reduction in planning time"],
            ["0", "Hard constraint violations"],
            ["10k+", "Shifts optimized monthly"],
          ].map(([n, label]) => (
            <div key={label}>
              <p className="bg-emerald-700 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
                {n}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bento features */}
      <section id="product" className="reveal mx-auto w-full max-w-7xl scroll-mt-24 px-6 py-24">
        <div className="mb-14 max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-600">Product</p>
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
            Everything a rota needs. Nothing it doesn&apos;t.
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            Roslanner takes the cognitive load off ward managers — legal compliance and staff
            satisfaction, at the same time.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {/* Large card: constraint engine */}
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-8 md:col-span-2">
            <h3 className="text-xl font-bold text-zinc-900">A constraint engine that speaks ward</h3>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-600">
              Minimum rest between shifts, night caps, seniority floors, pairing rules,
              charge leads — expressed as rules, enforced on every schedule and every edit.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                "≥ 11h rest between shifts",
                "Max 3 nights / week",
                "1 senior on every shift",
                "Interns always paired",
                "A lead per shift",
                "Block of nights → same time off",
              ].map((rule) => (
                <span
                  key={rule}
                  className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-sm"
                >
                  {rule}
                </span>
              ))}
            </div>
          </div>

          {/* Dark card: solver */}
          <div className="relative overflow-hidden rounded-3xl bg-zinc-900 p-8 text-white">
            <div aria-hidden="true" className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-600/40 blur-3xl" />
            <h3 className="relative text-xl font-bold">Seconds, not weekends</h3>
            <p className="relative mt-2 text-sm leading-relaxed text-zinc-300">
              The solver weighs thousands of candidate rosters and hands you the fairest one
              that satisfies every hard rule.
            </p>
            <p className="relative mt-6 font-mono text-xs text-emerald-300">
              solve(ward) → 2.4s ✓
            </p>
          </div>

          {/* Live checking */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-8">
            <h3 className="text-xl font-bold text-zinc-900">Live violation checking</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              Click any cell to change it and watch compliance and fairness recompute
              instantly — before you save.
            </p>
            <div className="mt-5 space-y-2 text-xs">
              <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 font-medium text-emerald-700">
                ✓ All hard constraints satisfied
              </p>
              <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 font-medium text-amber-700">
                ⚠ T. Hassan: 4th consecutive night
              </p>
            </div>
          </div>

          {/* Swaps */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-8">
            <h3 className="text-xl font-bold text-zinc-900">Rule-checked shift swaps</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              Staff offer and accept swaps themselves; anything that would break a rule is
              turned away before it reaches you.
            </p>
            <p className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-medium text-zinc-700">
              J. Mensah&apos;s Fri night ⇄ R. Adeyemi&apos;s Sun evening
              <span className="mt-1 block font-semibold text-emerald-600">Passes all rules → awaiting approval</span>
            </p>
          </div>

          {/* Leave + holidays */}
          <div className="rounded-3xl border border-zinc-200 bg-emerald-50/50 p-8">
            <h3 className="text-xl font-bold text-zinc-900">Leave, holidays &amp; fairness memory</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              Approved leave is untouchable. Public holidays are balanced across rosters, so
              whoever worked Christmas last year doesn&apos;t work it again.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">Leave — hard</span>
              <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700">Day-off request — soft</span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">Holiday — balanced</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="reveal scroll-mt-24 border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto grid w-full max-w-7xl gap-14 px-6 py-24 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-600">How it works</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
              Three steps to a published rota
            </h2>
            <p className="mt-4 text-lg text-zinc-600">
              Set it up once. From then on, each period is a button press and a review.
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2"
            >
              Start now — it&apos;s free
            </Link>
          </div>
          <ol className="space-y-10">
            {[
              {
                n: "01",
                title: "Describe the ward",
                body: "Wards, roles, staff, tiers and shifts. Start from a preset — standard three-shift, call duty, outpatient clinic — and adjust anything.",
              },
              {
                n: "02",
                title: "Set the rules",
                body: "Coverage per shift and role, rest minimums, night caps, seniority floors, day-scoped clinics, public holidays. Rules live with the ward, not the spreadsheet.",
              },
              {
                n: "03",
                title: "Generate, tweak, publish",
                body: "The solver produces the fairest compliant roster. Fine-tune cell by cell with live checking, then publish or export to CSV.",
              },
            ].map((s) => (
              <li key={s.n} className="relative flex gap-6">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-white font-mono text-sm font-bold text-emerald-600 shadow-sm">
                  {s.n}
                </span>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="reveal mx-auto w-full max-w-7xl scroll-mt-24 px-6 py-24">
        <div className="mb-14 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-600">Pricing</p>
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-zinc-600">Start planning immediately. No credit card required.</p>
        </div>

        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-zinc-200 bg-white p-9">
            <h3 className="text-lg font-bold text-zinc-900">Starter</h3>
            <p className="mt-1 text-sm text-zinc-500">Perfect for single wards and small clinics.</p>
            <p className="mt-6">
              <span className="text-5xl font-extrabold tracking-tight text-zinc-900">$0</span>
              <span className="text-zinc-500"> / forever</span>
            </p>
            <ul className="mt-8 space-y-3.5 text-sm text-zinc-700">
              <li className="flex items-center gap-3">{CHECK} Up to 2 wards</li>
              <li className="flex items-center gap-3">{CHECK} Up to 50 staff members</li>
              <li className="flex items-center gap-3">{CHECK} Basic constraint engine</li>
              <li className="flex items-center gap-3">{CHECK} Community support</li>
            </ul>
            <Link
              href="/signup"
              className="mt-9 block w-full rounded-2xl border border-zinc-300 px-4 py-3 text-center font-semibold text-zinc-900 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            >
              Get started
            </Link>
          </div>

          <div className="relative rounded-3xl bg-zinc-900 p-9 text-white shadow-2xl shadow-zinc-900/20">
            <span className="absolute right-6 top-6 rounded-full bg-emerald-700 px-3 py-1 text-xs font-bold uppercase tracking-wide">
              Popular
            </span>
            <h3 className="text-lg font-bold">Enterprise</h3>
            <p className="mt-1 text-sm text-zinc-400">For hospitals with complex scaling needs.</p>
            <p className="mt-6">
              <span className="text-5xl font-extrabold tracking-tight">$299</span>
              <span className="text-zinc-400"> / month</span>
            </p>
            <ul className="mt-8 space-y-3.5 text-sm text-zinc-200">
              <li className="flex items-center gap-3">{CHECK} Unlimited wards &amp; staff</li>
              <li className="flex items-center gap-3">{CHECK} Advanced fairness analytics</li>
              <li className="flex items-center gap-3">{CHECK} Custom constraint rules</li>
              <li className="flex items-center gap-3">{CHECK} 24/7 priority support</li>
            </ul>
            <Link
              href="/signup"
              className="mt-9 block w-full rounded-2xl bg-emerald-700 px-4 py-3 text-center font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="reveal px-6 pb-24">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-emerald-700 px-8 py-20 text-center text-white shadow-2xl shadow-emerald-500/30">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(60%_60%_at_50%_40%,black,transparent)]"
          />
          <h2 className="relative mx-auto max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            Give the spreadsheet its weekend off.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-emerald-100">
            Set up your ward and publish a compliant, fair roster today.
          </p>
          <Link
            href="/signup"
            className="relative mt-9 inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-bold text-emerald-700 shadow-xl transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-600"
          >
            Create your first roster
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-14 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-xs text-sm text-zinc-500">
              Constraint-based medical roster planning, per ward, for hospitals of every size.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-zinc-500">
              <li><a href="#product" className="rounded transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">Features</a></li>
              <li><a href="#how" className="rounded transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">How it works</a></li>
              <li><a href="#pricing" className="rounded transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">Pricing</a></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900">Company</p>
            <ul className="mt-3 space-y-2 text-sm text-zinc-500">
              <li><a href="#" className="rounded transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">Privacy policy</a></li>
              <li><a href="#" className="rounded transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">Terms of service</a></li>
              <li><a href="#" className="rounded transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-zinc-200 py-6 text-center text-sm text-zinc-400">
          &copy; {new Date().getFullYear()} Roslanner Inc. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
