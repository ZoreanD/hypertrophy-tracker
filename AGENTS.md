<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

If fixing slow client-side navigations, Suspense alone is not enough. You must also export `unstable_instant` from the route. Read `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.mdx` before making changes.
<!-- END:nextjs-agent-rules -->

---

# Zorean Hypertrophy Tracker — Agent Rules

## Stack

- **Next.js 16** (App Router, React 19, Server Actions, Turbopack dev)
- **Prisma 7** with **Neon PostgreSQL** via `@prisma/adapter-pg`
- **Tailwind CSS 4** — CSS-variable theming (`--c-*` in `app/globals.css`)
- **Custom JWT auth** (`jose` + `bcrypt`) — `auth_token` HTTP-only cookie, 30-day expiry
- **Web Push** (`web-push` + VAPID) + **Upstash QStash** for delayed callbacks
- **Recharts** for progression & volume charts
- **No external state management** — React 19 primitives + Server Actions + localStorage

## Critical Gotchas (read every one)

### Next.js 16 / React 19
- `params` and `searchParams` in page components are **Promises** — you MUST `await` them.
- Server Actions are in `app/actions/`. Don't mix server action logic into client components.

### Database / Prisma
- Profile lookup MUST use `prisma.profile.findUnique({ where: { userId } })` — **never** `findFirst()`.
- `Workout` has NO `createdAt` column — use `date`. `Set` HAS `createdAt`.
- Enum casts in raw SQL need double quotes: `::"Muscle"`, `::"Equipment"`.
- Table/column names are quoted PascalCase/camelCase (`"User"`, `"Workout"`, `"profileId"`).
- DB connection: Neon via `POSTGRES_PRISMA_URL` env var. Direct queries use `pg` Pool.

### Auth
- JWT in `auth_token` HTTP-only cookie (`lib/auth.ts`, `jose`), 30-day maxAge.
- `verifyToken()` returns `null` on invalid/expired — don't assume it throws.
- Per-user session resolved via `lib/session.ts` → `getProfileFromCookie()`.

### Theming
- Colors are CSS variables in `app/globals.css` (`--c-*` remapping Tailwind tokens).
- Default theme = `:root`, alternates under `[data-theme="…"]`.
- A "wrong color in a theme" bug is almost always a missing `--c-*` override, NOT a component change.
- `green` is intentionally hardcoded for "completed" status across ALL themes — don't change this.

### Push Notifications
- Rest-timer + social notifications go through `lib/push.ts` → `sendPushToProfile` and `scheduleRestPush`.
- Service worker is `public/sw.js` — **bump `CACHE_NAME`** whenever you change it.
- Background delivery requires `urgency: 'high'` on the push payload.
- Full flow documented in `docs/web-push-setup.md`.

### Volume & Progression Math
- Primary muscles get **1.0** volume credit, secondary synergists get **0.5**.
- Decline detection is **conservative**: requires ≥5% drop across **2 consecutive sessions** before deload suggestion.
- e1RM is calculated on **effective working load** — accounts for assisted counterweights, bodyweight, and per-side loads (`lib/effectiveLoad.ts`).
- Position-aware history (`lib/positionHistory.ts`) compares exercises at comparable fatigue slots.
- Drop-set drops and myo-rep minis are excluded from setting e1RM to prevent fatigue distortion.
- Unilateral (L/R) sets each count as **0.5 working sets** — a pair = 1 set.

### Training States
- Three modes: `NORMAL`, `DELOAD`, `RETURNING` (after a layoff).
- `RETURNING` applies automated load scale factor + extra RIR suggestions.
- Planned deloads and comebacks must NOT be flagged as performance declines.

## Verification Gates (REQUIRED before any push)

Every change MUST pass these in order:

1. `npx tsc --noEmit` — type check
2. `npm run build` — full production build (includes `prisma generate`)
3. **Puppeteer E2E** — run against dev server using dedicated QA account (see below)

Only push to `main` after all three pass. We work directly on `main`.

## QA Test Account

| Field | Value |
|-------|-------|
| Username | `puppeteer_qa` |
| Password | `PptrQA_2026!` |
| Profile ID | `520f99eb-7c84-4919-9f55-8ad4230258b4` |

**Rules**: Never log in as or touch other user data. Clean up ALL test data after every test run. Never delete the User/Profile rows themselves.

## DB Access Pattern

```bash
node -e "require('dotenv').config(); const {Pool}=require('pg'); const p=new Pool({connectionString:process.env.POSTGRES_PRISMA_URL}); p.query('SELECT ...').then(r=>{console.log(r.rows); p.end();});"
```

Prefer read-only queries. Only run writes for data corrections — make them idempotent and narrowly scoped.

## Bug Workflow

1. Pull open suggestions from `Suggestion` table in DB (status = `NEW`)
2. Present to user for triage
3. Fix with minimal, root-cause changes
4. Pass all verification gates
5. Mark suggestion as `SHIPPED` in DB
6. Git commit + push to `main`

## Key Files

| File | Purpose |
|------|---------|
| `app/workout/[workoutId]/LiveWorkout.tsx` | Core workout logging (~2,700 lines) |
| `prisma/schema.prisma` | Full data model |
| `prisma/seed.ts` | Exercise anatomy engine (EMG-based) |
| `lib/effectiveLoad.ts` | Load normalization math |
| `lib/declineDetection.ts` | Conservative deload detection |
| `lib/volume.ts` | Weekly volume rollups vs MEV/MAV |
| `lib/positionHistory.ts` | Fatigue-position-aware comparison |
| `app/globals.css` | CSS-variable theming system |
| `public/sw.js` | Service worker (push, cache, rest timers) |
| `lib/changelog.ts` | What's New versioning |
