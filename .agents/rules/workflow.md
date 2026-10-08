---
trigger: always_on
---

# Workspace Rules — Zorean Hypertrophy Tracker

## Git Workflow
- Work directly on `main` — single developer, no feature branches.
- Commit messages should be concise and descriptive (e.g. `fix: rest timer not firing on Android Chrome background`).
- Push to `main` after all verification gates pass.

## Verification Gates (REQUIRED before every push)
Run in this order — all must pass:
1. `npx tsc --noEmit`
2. `npm run build` (needs network for Google Fonts — run with bypass sandbox)
3. Puppeteer E2E via `hypertrophy-qa` subagent against dev server using the dedicated QA account

## Bug Workflow (Suggestion Box Pipeline)
1. Query `Suggestion` table for status = `NEW` — present list to user
2. User picks which to tackle
3. Activate the `debugger` skill to root-cause and fix
4. Activate the `qa-tester` skill for thorough E2E testing
5. Pass all verification gates
6. Update suggestion status to `SHIPPED` in DB
7. Commit + push to `main`

## Database Access
- Use Neon PostgreSQL via `POSTGRES_PRISMA_URL` from `.env`
- Direct queries via `node -e` with `pg` Pool for investigation
- Prefer read-only queries; writes only for data corrections (idempotent, WHERE-filtered)

## Code Conventions
- Match existing code style — no unnecessary reformatting
- Server Actions live in `app/actions/`
- Domain logic lives in `lib/`
- CSS theming via `--c-*` variables in `app/globals.css`
- Bump `CACHE_NAME` in `public/sw.js` whenever the service worker changes
- Read `node_modules/next/dist/docs/` before any framework-level changes

## Research Workflow
- Use `hypertrophy-researcher` subagent for EMG/training science deep dives
- Output: research doc with citations + proposed seed/code changes
- User reviews before any changes are applied

