---
name: debugger
description: >-
  Root-causes bugs in the hypertrophy tracker — reproduces the failure, isolates the cause,
  applies a minimal fix, and verifies with type check + build. Use for runtime errors, redirect
  loops, wrong data/queries, auth issues, push/notification failures, theme/CSS regressions,
  or any "X isn't working" report from the suggestion box.
---

# Debugger Skill

You are debugging the **Zorean Hypertrophy Tracker** — a Next.js 16 (App Router, Server Actions,
React 19) + Prisma 7 + Neon PostgreSQL app deployed on Vercel, with Web Push (web-push + Upstash
QStash) and a CSS-variable theming system.

## Goal

Find the **ROOT CAUSE** of a reported bug, fix it minimally, and prove the fix.
Do not paper over symptoms. Do not expand scope beyond the bug unless a second
defect is directly in the blast radius (say so if you find one).

## Method (follow in order)

1. **Reproduce / confirm the failure.** Reread the exact error text or described behavior.
   Distinguish *server* errors (Next error digest, redirect loops, 5xx) from *client* errors
   (hydration, runtime exceptions) from *data* bugs (wrong query results).

2. **Isolate.** Read the specific code path. Use grep/search, don't guess. For redirects/auth,
   trace every `redirect()` and cookie/`verifyToken` check — loops are usually one page checking
   token *presence* vs another checking *validity*, or a query returning the wrong row
   (e.g. `findFirst()` instead of `findUnique`).

3. **Check the data when relevant.** Query the live DB directly (read-only first) with:
   ```bash
   node -e "require('dotenv').config(); const {Pool}=require('pg'); const p=new Pool({connectionString:process.env.POSTGRES_PRISMA_URL}); p.query('SELECT ...').then(r=>{console.log(r.rows); p.end();});"
   ```
   Table/column names are quoted PascalCase/camelCase (`"User"`, `"Workout"`, `"profileId"`).

4. **Form a specific hypothesis**, then confirm it before editing. State the concrete
   input → wrong output.

5. **Apply the minimal fix.** Match surrounding code style. Keep the default behavior
   unchanged unless the bug IS the default.

6. **Verify.** Run `npx tsc --noEmit` and `npm run build`. For data fixes, re-query to confirm.

## Critical Gotchas

- `params` and `searchParams` in pages are **Promises** — must `await` them.
- Profile lookup: always `findUnique({ where: { userId } })`, never `findFirst()`.
- `Workout` has no `createdAt` — use `date`; `Set` has `createdAt`.
- Enum casts in raw SQL need double quotes: `::"Muscle"`, `::"Equipment"`.
- Theming: CSS vars `--c-*` in `app/globals.css`. Color bugs = missing CSS variable override.
- Completed workout green is hardcoded across themes — intentional.
- Push: `lib/push.ts` + QStash. SW is `public/sw.js` (bump `CACHE_NAME` on changes).
- e1RM excludes drop-set drops and myo-rep minis to prevent fatigue distortion.
- Read `node_modules/next/dist/docs/` before changing any framework-level code.

## Guardrails

- Prefer read-only DB queries. Only write when the fix IS a data correction — make it idempotent and narrowly WHERE-filtered.
- If the root cause is genuinely ambiguous, report top hypotheses with evidence rather than guessing.

