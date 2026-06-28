# Zorean Hypertrophy Tracker

A science-based hypertrophy training app: plan routines, log workouts with
proper progressive-overload tracking, and follow other lifters Strava-style to
trial their routines and chase their numbers.

## Features

- **Granular anatomy engine** — exercises tagged with primary/secondary muscles
  at the muscle-head level (e.g. triceps long vs. lateral head) from EMG
  literature, with science notes surfaced as tooltips.
- **Smart workout logging** — straight sets, supersets, myo-reps, drop sets;
  unilateral (L/R) tracking; time-based exercises (stopwatch); optimistic logging
  with progressive-overload history and post-session summaries.
- **Routine builder + calendar** — plan mesocycles, schedule sessions, track
  weekly volume against MEV/MAV/MRV landmarks.
- **Mid-workout flexibility** — swap exercises, add ad-hoc exercises, remove an
  exercise, or discard/leave-and-resume a session without it counting as complete.
- **Rest-timer notifications** — fire even when the app is backgrounded, via Web
  Push (see [docs/web-push-setup.md](docs/web-push-setup.md)).
- **Social / routine sharing** — follow lifters, view their shared routines with
  their live `weight × reps @ RIR` per exercise, get notified when they finish,
  and trial a routine (your numbers carry over if you save it; their numbers
  never do). Share via followers or a link. See
  [docs/social-routine-sharing-plan.md](docs/social-routine-sharing-plan.md).
- **PWA** — installable, with a service worker for offline shell + notifications.

## Tech stack

- **Next.js 16** (App Router, server actions) + **React 19**
- **Prisma 7** with **Neon** PostgreSQL (`@prisma/adapter-pg`)
- **Tailwind CSS 4**
- **Web Push** (`web-push` + VAPID) with **Upstash QStash** for delayed callbacks
- Auth via JWT in an http-only cookie (`jose` + `bcrypt`)

> Note: this project tracks a customized build of Next.js — read the guides in
> `node_modules/next/dist/docs/` before changing framework-level code, as APIs may
> differ from upstream.

## Getting started

### 1. Environment

Create `.env` (gitignored) with at least:

```bash
POSTGRES_PRISMA_URL=postgresql://…            # Neon connection string
JWT_SECRET=…                                  # any long random string
```

For rest-timer / social push notifications, also set the Web Push + QStash vars
documented in [docs/web-push-setup.md](docs/web-push-setup.md)
(`VAPID_*`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `QSTASH_*`, `APP_URL`).

### 2. Database

```bash
npx prisma db push     # apply the schema to your database
npx prisma db seed     # load the exercise library
```

### 3. Run

```bash
npm run dev            # http://localhost:3000
```

## Common commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | `prisma generate` + production build |
| `npm start` | Run the production build |
| `npx prisma db push` | Sync schema to the DB (use after schema changes) |
| `npx prisma db seed` | Upsert the exercise library |
| `npx prisma studio` | Browse the database |

## Project layout

```
app/
  actions/      server actions (workout-session, routine, social, …)
  workout/      live + completed workout screens
  routines/     routine builder, list, sharing controls
  following/    social hub (search, follow, activity feed)
  u/[username]/ public profile
  shared/[id]/  shared routine view (owner's live numbers)
  r/[token]/    share-link entry point
  api/push/     Web Push subscribe/schedule/cancel/send
lib/
  prisma.ts     Prisma client (Neon adapter)
  social.ts     follow/visibility access helpers + live-numbers
  push.ts       Web Push sender + QStash scheduling
  auth.ts       JWT + password hashing
prisma/
  schema.prisma
  seed.ts       exercise library
docs/           feature design + setup notes
```

## Deployment

Deployed on Vercel. `npm run build` runs `prisma generate` automatically. After
schema changes, run `npx prisma db push` against the production database and set
the required environment variables in the Vercel project settings.
