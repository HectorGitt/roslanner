# Roslanner — Ward Roster Planner

Constraint-based medical roster planning per ward, multi-tenant per hospital.
Set up wards, roles (Doctor, Nurse, …), staff, coverage requirements and rest
rules — then generate a roster that satisfies them, and fine-tune it cell by
cell with live violation checking.

## Quick start

```bash
npm install
npm run db:deploy  # apply migrations to your Postgres database
npm run db:seed    # optional: demo hospital, wards, staff, coverage, leave
npm run dev        # http://localhost:3000
```

`.env` needs:

- `DATABASE_URL` — a Postgres connection string, e.g.
  `postgresql://user:password@host:5432/roslanner?sslmode=require`
- `BETTER_AUTH_SECRET` (any long random string)
- `BETTER_AUTH_URL` (the app URL)

### Database (GCP Cloud SQL)

The app runs on Postgres and is deployed with a dedicated
[Cloud SQL](https://cloud.google.com/sql) instance so it works from
serverless hosts (Netlify, Vercel, …) whose functions have no persistent
local disk — a file-based SQLite DB doesn't survive between invocations
there.

To provision one yourself:

```bash
gcloud sql instances create <name> \
  --edition=enterprise \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --root-password=<strong-password>

gcloud sql databases create roslanner --instance=<name>
gcloud sql users create roslanner_app --instance=<name> --password=<strong-password>
gcloud sql instances patch <name> --ssl-mode=ENCRYPTED_ONLY --authorized-networks=0.0.0.0/0
```

The last step opens the instance to the public internet over TLS — needed
because serverless hosts don't have static outbound IPs to allowlist
instead. Rely on a strong password and `sslmode=require` in the connection
string. If your host does have static egress IPs, replace `0.0.0.0/0` with
those for tighter access control.

Demo login after seeding: **admin@demo.hospital / password123**
(hospital invite code: `DEMO-2026`).

## Authentication & tenancy

[Better Auth](https://better-auth.com) with email + password. Every account
belongs to one **hospital** workspace:

- **Sign up → create a hospital** — you become its `ADMIN` and get an invite code.
- **Sign up → join with an invite code** — you join as a `MEMBER`.
- All wards, roles, staff, leave and rosters are scoped to your hospital;
  every API route verifies ownership (cross-hospital access returns 404).
- `/settings` shows the workspace, invite code and member list.
- Route protection lives in `src/proxy.ts` (optimistic cookie check) and
  `src/lib/session.ts` (real session verification in API routes).

## How it works

Nothing about the shift model is hardcoded — each hospital configures its own.

- **Shifts** (per ward): a ward defines its own shifts with real clock times, and
  flags which count as nights. Morning/Afternoon/Night, Day vs overnight Call
  Duty, or clinic sessions are all just data; new wards start from a preset and
  stay editable. One shift per person per day, or a day off.
- **Cycle length** (per ward): 7 days for weekly wards, 30 for a monthly stretch.
- **Staff groups** (per hospital): bodies of staff rostered *separately* because
  their rules don't match — doctors on day and overnight call, nurses on three
  shifts, domestic staff on weekdays only, all on the same ward. A group is a set
  of roles, so a person's group comes from their role and the two can't disagree.
  Each group can have its own shifts, coverage and rules; whatever it doesn't
  define, it inherits from the ward. Group config **replaces** the ward's for that
  group rather than adding to it, so one shift code can't mean two different
  things and a nursing requirement can't leak into the doctors' roster. Groups are
  optional: a ward with none behaves exactly as before, one roster for everybody.
- **Staff tiers** (per hospital): your own hierarchy, with per-shift eligibility
  (e.g. senior staff on mornings only, never weekends), tier-specific night caps,
  and pairing rules (an intern is never rostered without a senior present).
- **Coverage** (per ward): minimum staff per shift, scoped by role, by tier, or
  both — so "2 nurses" and "at least one senior, any role" are enforced together.
  A requirement can also be limited to certain days of the week, and told whether
  it applies on public holidays — which is what lets a clinic close at weekends or
  a ward run skeleton holiday cover.
- **Additional rules** (per ward): rules that carry their own setting and may
  apply to one tier or one shift — a block of nights earning the same time off, a
  cap on hours in any rolling seven days, and requiring someone in charge of each
  shift. The set of rule types lives in code (`evaluate()` has a branch per type);
  only their thresholds and scope are data, so a hospital configures rather than
  a developer redeploys.
- **Rules** (per ward): max consecutive working days, max nights per week, max
  consecutive nights, min days off per week, and minimum rest hours between
  shifts — computed from the shifts' actual times, so it catches any too-quick
  turnaround rather than just a morning after a night.
- **Floating staff**: someone based in one ward can be made eligible for others.
  Wards are rostered independently, so a `StaffDailyCommitment` row per person
  per date — unique on (staff, date) — is what makes double-booking impossible to
  record and visible when attempted. Rest is checked across wards too, so a
  floater can't finish call duty at 08:00 and start a morning shift elsewhere the
  same hour. Only **published** rosters commit anyone: drafts are proposals, so
  two drafts for one period don't collide with each other, and a draft is still
  checked against other wards' published rosters.
- **Leave**: approved leave is a hard constraint; day-off requests are honoured
  when possible (soft).
- **Public holidays** (per hospital): recorded per year and grouped by name, so
  they can be treated apart from ordinary days — a tier can be kept off them, and
  who worked them is balanced over years rather than within one roster.
- **Fairness**: nights, weekend shifts, public holidays and total shifts are
  balanced across staff of the same role, comparing only staff eligible for that
  kind of shift, and per FTE so a half-time member of staff is balanced to half
  the load. Set a **fairness window** on a ward to fold in what people already
  worked in published rosters, so shares even out across periods instead of
  resetting every time.

### Solver

`src/lib/roster/solve.ts` — a two-phase heuristic:

1. **Greedy construction**: fills coverage day by day (nights first), skipping
   staff who would break a hard rule, preferring those with fewer shifts/nights.
2. **Local search**: ~2s of hill climbing over swap/reassign moves, scored by
   `src/lib/roster/engine.ts` (hard violations ≫ soft ≫ fairness spread).

The same `evaluate()` engine runs **in the browser** on the roster page, so
every manual edit re-validates instantly — no server round-trip. If a ward is
genuinely understaffed the solver still returns its best attempt and lists
exactly which shifts can't be covered.

### Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Prisma 6 + PostgreSQL (GCP Cloud SQL)

## Data model

`Ward` → `Staff` (each with a `Role`) · `CoverageRequirement` (ward × shift ×
role → headcount) · `RuleSet` (per ward) · `LeaveRequest` (hard `LEAVE` / soft
`DAY_OFF_REQUEST`) · `Roster` → `Assignment` (staff × day → shift).
