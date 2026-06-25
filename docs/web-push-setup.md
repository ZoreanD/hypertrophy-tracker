# Rest-timer Web Push setup

Long rests (>~2 min) can't be notified client-side on Android Chrome — the
service worker is frozen/killed before the timer fires. Web Push fixes this: a
delayed server callback (via Upstash QStash) sends a push at the rest's end
time, which wakes the SW even when it's dead.

## Flow

1. On the workout screen the browser subscribes to push → `POST /api/push/subscribe`
   stores it (`PushSubscription` table).
2. When you background the app mid-rest, the client calls `POST /api/push/schedule`
   with the remaining seconds. That sets a one-time `restNonce` on the profile
   and asks QStash to call back after the delay.
3. At the end time QStash calls `POST /api/push/send`. If the nonce still matches
   (not cancelled / superseded), it sends the push; the SW `push` handler shows
   the notification.
4. Returning to the app, skipping, or finishing calls `POST /api/push/cancel`,
   which clears the nonce so a queued callback no-ops.

## Required environment variables

Set these locally in `.env` and in Vercel (Project → Settings → Environment Variables):

| Var | Where to get it | Notes |
|-----|-----------------|-------|
| `VAPID_PUBLIC_KEY` | `npx web-push generate-vapid-keys` | server |
| `VAPID_PRIVATE_KEY` | same command | **secret** |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | same value as `VAPID_PUBLIC_KEY` | exposed to client |
| `VAPID_SUBJECT` | `mailto:you@example.com` | contact for push services |
| `QSTASH_TOKEN` | console.upstash.com → QStash | **secret**; free tier is plenty |
| `QSTASH_URL` | QStash dashboard (regional base URL) | optional; defaults to `https://qstash.upstash.io` |
| `APP_URL` | your deployed origin, e.g. `https://your-app.vercel.app` | no trailing slash; QStash calls back here |

Notes:
- `APP_URL` must be a public HTTPS URL in production so QStash can reach
  `/api/push/send`. Local `http://localhost:3000` won't receive QStash callbacks
  (no public URL) — that's expected; test push on the deployed site.
- After adding `MEDICINE_BALL`/push schema changes, run `npx prisma db push`.
