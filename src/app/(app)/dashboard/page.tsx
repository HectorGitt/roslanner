"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  ButtonLink,
  EmptyState,
  ListCard,
  LoadingState,
  Badge,
  PageHeader,
  StatCard,
} from "@/components/ui";

interface WardRow {
  id: string;
  name: string;
  _count: { staff: number; rosters: number };
}
interface RosterRow {
  id: string;
  startDate: string;
  days: number;
  status: string;
  ward: { name: string };
  createdAt: string;
}

export default function Dashboard() {
  const [wards, setWards] = useState<WardRow[]>([]);
  const [rosters, setRosters] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api<WardRow[]>("/api/wards"), api<RosterRow[]>("/api/rosters")])
      .then(([w, r]) => {
        setWards(w);
        setRosters(r);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState label="Loading your dashboard…" />;

  const totalStaff = wards.reduce((n, w) => n + w._count.staff, 0);
  const published = rosters.filter((r) => r.status === "PUBLISHED").length;
  const drafts = rosters.length - published;
  const recent = rosters.slice(0, 6);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Dashboard"
        description="Overview of your wards, staff, and active rosters."
        actions={
          <ButtonLink href="/rosters">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Roster
          </ButtonLink>
        }
      />

      {wards.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Wards"
            value={wards.length}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />
          <StatCard
            label="Staff"
            value={totalStaff}
            hint="across all wards"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
          />
          <StatCard
            label="Published"
            value={published}
            hint="live rosters"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label="Drafts"
            value={drafts}
            hint="awaiting review"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            }
          />
        </div>
      )}

      {wards.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
          title="No wards found"
          description="Get started by setting up your first ward, adding staff members, and defining coverage requirements."
          action={
            <ButtonLink href="/wards" variant="secondary">
              Create a Ward
            </ButtonLink>
          }
        />
      ) : (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-white">
              <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
              Your Wards
            </h2>
            <Link
              href="/wards"
              className="rounded text-sm font-medium text-emerald-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:text-emerald-400"
            >
              View all
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {wards.map((w) => (
              <Link
                key={w.id}
                href={`/wards/${w.id}`}
                className="group relative rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-900/50"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 transition-colors group-hover:bg-emerald-50 group-hover:text-emerald-600 dark:bg-zinc-800 dark:text-zinc-300 dark:group-hover:bg-emerald-900/20 dark:group-hover:text-emerald-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <svg className="h-5 w-5 -translate-x-2 text-zinc-400 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <h3 className="truncate font-semibold text-zinc-900 dark:text-white">{w.name}</h3>
                <div className="mt-3 flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    {w._count.staff}
                    <span className="sr-only">staff</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {w._count.rosters}
                    <span className="sr-only">rosters</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-white">
              <div className="h-2 w-2 rounded-full bg-indigo-500"></div>
              Recent Rosters
            </h2>
          </div>
          <ListCard>
            {recent.map((r) => (
              <Link
                key={r.id}
                href={`/rosters/${r.id}`}
                className="group flex items-center justify-between px-5 py-4 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/60 dark:hover:bg-zinc-800/50"
              >
                <div className="flex items-center gap-4">
                  <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 sm:flex">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-900 transition-colors group-hover:text-emerald-600 dark:text-white dark:group-hover:text-emerald-400">
                      {r.ward.name}
                    </span>
                    <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500 sm:text-sm">
                      <span>{new Date(r.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                      <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
                      <span>{r.days} days</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={r.status === "PUBLISHED" ? "success" : "warning"} className="tracking-wide">
                    {r.status}
                  </Badge>
                  <svg className="h-5 w-5 text-zinc-400 transition-colors group-hover:text-zinc-600 dark:group-hover:text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </ListCard>
        </section>
      )}
    </div>
  );
}
