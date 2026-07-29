# Known issues and open decisions

Running list of things found while building, deliberately deferred, or needing a
call from the product side.

A full four-part audit (security, engine correctness, data integrity, frontend)
was run in July 2026 — see [audit-2026-07.md](audit-2026-07.md). It supersedes
this file for anything it covers; the items below are the ones it did not, plus
the standing product decisions.

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
day and drives staff toward their limits, so on a tight ward the last day has
nobody eligible left. Local search often repairs it but not reliably inside its
2s budget: the demo General Ward, which carries the most rules (a seniority
floor, a lead per shift and a 48h weekly cap), still shows two or three gaps on
its last day after several re-optimise attempts, while the other three wards
solve cleanly.

Biasing the greedy toward staff with slack left in the week was tried and made no
difference, so it was reverted rather than left in unexplained. A real fix needs
construction to weigh remaining demand against remaining capacity — reserving
people for later days — or to fill the period in an order that doesn't starve the
end. Re-optimising is the workaround in the meantime.

**Violation weighting is a policy default, not a fact.** Breaches of a person's
entitlements (approved leave, tier eligibility, already working another ward)
weigh above a coverage shortfall, on the grounds that a gap is visible and can be
filled by calling someone in. A ward that would rather run short than misassign
wants the opposite. Set in `VIOLATION_WEIGHT` in `src/lib/roster/engine.ts`.

**Raising `minRestHours` will surface violations that were previously invisible.**
The rule now computes real rest from shift times, so setting 11–12h (as the SRS
asks) flags turnarounds the old morning-after-night boolean never checked, e.g.
an afternoon finishing 22:00 before a morning starting 08:00.

**Swaps are driven by the planner, not by staff.** `Staff` records aren't linked
to `User` accounts, so nobody but a hospital admin can sign in. The swap state
machine is the real two-party handshake — offer, accept with a rule check, then
approval — but today one person drives all three steps on others' behalf. Letting
nurses raise and accept their own swaps needs Staff↔User linking and a staff-facing
permission level.

## Modelling

**A staff group is a set of roles, so one person can't be rostered outside their
role's group.** The nurse who rosters with the medical team can't be expressed —
you'd have to give them a distinct role. This was chosen over a per-staff group
field so that a person's group can never contradict their role, and because it
means one place to configure rather than one per person.

**Group config replaces the ward's rather than merging with it.** A group that
overrides one shift must list them all. Merging was rejected because a ward-level
`MORNING` and a group-level `MORNING` with different times would need an invented
tie-break, and because a ward-wide "3 nurses" requirement would otherwise land in
the doctors' roster as a shortfall nobody could fill. The UI says which scope it's
editing and whether anything is currently overridden.

**`CoverageRequirement` has no unique key.** It would have to include
`daysOfWeek` to allow a weekday/weekend split of the same role, and Prisma can't
put a list in a unique index — the previous key rejected that split with an
unhandled 500. It also enforced nothing whenever `roleId` or `tierId` was null,
since Postgres treats NULLs as distinct. Duplicates are now rejected by the write
path, which replaces a whole scope at once and so sees the full set.

**Compound uniques containing `groupId` don't constrain the ward-level row**, for
the same NULL reason — `ShiftDefinition` and `RuleSet` are both affected. Adding
partial indexes for the `groupId IS NULL` case was considered and rejected:
Prisma doesn't model them, so `migrate diff` would report them as drift and a
later `migrate dev` would offer to drop them. Enforced in the write paths instead.

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
