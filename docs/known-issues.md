# Known issues and open decisions

Running list of things found while building, deliberately deferred, or needing a
call from the product side. Newest sections first within each group.

## Deployment

**`BETTER_AUTH_URL` must match the deployed site URL.** In production the auth
config trusts only that one origin, so if it still points at
`http://localhost:3000` every sign-in fails with "Invalid origin" — which reads
like a credentials problem but isn't. Dev trusts any localhost port by pattern.

**Migrations are not applied by the build.** The build runs `prisma generate`,
not `prisma migrate deploy`, so a new migration reaches production only when
someone runs `npm run db:deploy`. Automating it in the build was deliberately
avoided: branch and preview builds share the same `DATABASE_URL`, so they would
migrate production. Fixing this properly means either a separate deploy step or
a preview database.

**Connection limits on `db-f1-micro`.** Prisma's pool was exhausted during
development (`P2024`, limit 9). Serverless makes this worse: each Netlify
function instance keeps its own pool, and the smallest Cloud SQL tier allows few
connections. Before real traffic, add `?connection_limit=1` to the production
`DATABASE_URL` or put a pooler in front.

**One database serves both local development and production.** There is no
staging copy, so a local script writing to `DATABASE_URL` writes to production.

## Solver

**The greedy pass can leave the final day of a period short.** It fills day by
day and drives staff toward their consecutive-day limit, so on a tight ward the
last day has nobody eligible left. Local search usually repairs it but not
always inside its 2s budget — General Ward needed a second attempt to cover a
Sunday. Re-optimising is the current workaround; a real fix would make
construction aware of remaining demand against remaining capacity, or process
days in an order that doesn't starve the end.

**Violation weighting is a policy default, not a fact.** Breaches of a person's
entitlements (approved leave, tier eligibility, already working another ward)
weigh above a coverage shortfall, on the grounds that a gap is visible and can be
filled by calling someone in. A ward that would rather run short than misassign
wants the opposite. Set in `VIOLATION_WEIGHT` in `src/lib/roster/engine.ts`.

**Raising `minRestHours` will surface violations that were previously invisible.**
The rule now computes real rest from shift times, so setting 11–12h (as the SRS
asks) flags turnarounds the old morning-after-night boolean never checked, e.g.
an afternoon finishing 22:00 before a morning starting 08:00.

## Modelling

**Coverage cannot vary by day of week or on public holidays.** A requirement
applies to every day of the roster, so an outpatient clinic that closes at
weekends, a ward with lighter weekend cover, or skeleton holiday staffing can't
be expressed. Worked around in the demo data by staffing the clinic for seven
days.

**Draft rosters in different wards can double-book the same person.** Only
published rosters hold commitments, so a clash between two drafts surfaces when
the first is published. This is the deliberate trade for letting planners hold
several overlapping drafts for one period without them colliding with each other.

**`countsTowardClinicalCoverage` doesn't apply to role-scoped coverage.** It
affects tier-scoped and plain headcount requirements only. Excluding support
staff from a requirement naming their own role would make it permanently
unsatisfiable.

**`Assignment.shift` stores a shift code, not a foreign key.** A published roster
is a record of what was worked, so it survives a ward renaming or removing a
shift; the cost is that a removed shift shows as "(removed)" in old rosters
rather than being cleaned up.

**Deleting a tier silently clears it from staff** (`onDelete: SetNull`), removing
whatever protections it carried. The UI warns, the database doesn't.

## Housekeeping

**No automated tests.** Everything has been verified with throwaway scripts
against a running app. The engine is pure and synchronous, so `evaluate()` and
`solve()` are straightforward to unit test — worth doing before the rule set
grows further.

**Prisma 6 with 7 available.** A major upgrade, deliberately not taken mid-build.

**An empty "Male surgical ward" exists in the demo data.** Created through the
UI, has no staff, so roster generation skips it.
