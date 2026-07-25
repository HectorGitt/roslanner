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

- **Shifts**: Morning / Afternoon / Night / DO (day off), one per person per day.
- **Coverage** (per ward): how many of each role each shift needs, every day.
- **Rules** (per ward): max consecutive working days, max nights per week, max
  consecutive nights, min days off per week, no morning straight after a night.
- **Leave**: approved leave is a hard constraint; day-off requests are honoured
  when possible (soft).
- **Fairness**: nights, weekend shifts and total shifts are balanced across
  staff of the same role.

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
