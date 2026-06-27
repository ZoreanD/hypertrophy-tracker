# Social routine sharing — architecture & phased plan

A Strava-style layer: follow other users, view their shared routines, and
opt in to see their lift numbers + get a live update each time they finish
that routine. Optionally clone a shared routine into your own.

## Core principles

- **Identity = `Profile`.** All social edges hang off `Profile` (where the data
  lives). `User` keeps auth + unique `username`; we'll likely add a
  `displayName`/avatar to `Profile` later for nicer presentation.
- **Sharing is the precondition; subscribing is the consent.** An owner marks a
  routine shareable. A viewer then explicitly opts in ("Do you want to see
  <owner>'s numbers and get an update every time they complete this routine?").
  Until they opt in, they see structure only — never the owner's numbers.
- **"Live" is free.** The owner's numbers are read live from their most recent
  *completed* workout (`durationMins > 0`) on that routine, so they update the
  moment the owner finishes. No materialized snapshot to keep in sync.
- **Save = deep copy.** Cloning copies routine structure (exercises + targets)
  into the viewer's own `Routine`; it never copies the owner's performance.

## Data model additions

```prisma
// One-way follow (Strava-style).
model Follow {
  id          String   @id @default(uuid())
  followerId  String   // Profile doing the following
  followingId String   // Profile being followed
  createdAt   DateTime @default(now())
  follower    Profile  @relation("Following", fields: [followerId],  references: [id], onDelete: Cascade)
  following   Profile  @relation("Followers", fields: [followingId], references: [id], onDelete: Cascade)
  @@unique([followerId, followingId])
  @@index([followingId])
}

// Routine visibility + share link + clone attribution (added to Routine).
enum RoutineVisibility { PRIVATE FOLLOWERS LINK }   // default PRIVATE
// Routine += visibility RoutineVisibility @default(PRIVATE)
//          shareToken String? @unique
//          clonedFromRoutineId String?   (+ self relation for "based on …")

// Receiver-side opt-in: I want <owner>'s numbers + live updates for THIS routine.
model RoutineSubscription {
  id               String   @id @default(uuid())
  subscriberId     String   // Profile opting in (the viewer)
  routineId        String   // the OWNER's routine being tracked
  notifyOnComplete Boolean  @default(true)
  createdAt        DateTime @default(now())
  subscriber       Profile  @relation(fields: [subscriberId], references: [id], onDelete: Cascade)
  routine          Routine  @relation(fields: [routineId],   references: [id], onDelete: Cascade)
  @@unique([subscriberId, routineId])
  @@index([routineId])
}
```

## Authorization rules (enforce centrally in one helper)

A viewer may **see a routine** if any of: they own it; `visibility = LINK` and
they have the token; `visibility = FOLLOWERS` and they follow the owner.
A viewer may **see the owner's numbers** only if they additionally have an
active `RoutineSubscription`. Every shared read goes through one
`canViewRoutine(profileId, routine)` / `canViewNumbers(...)` helper — no
ad-hoc checks in pages.

## Key flows

1. **Share:** owner sets a routine's visibility (FOLLOWERS or LINK); LINK mints
   a `shareToken` → `/r/<token>`.
2. **Discover:** search users by username → profile page → Follow. Profile page
   lists that user's shared routines.
3. **View shared routine:** structure always; if subscribed, each exercise shows
   the owner's latest `weight × reps @ RIR` (dated) next to your own targets —
   the challenge line.
4. **Opt in:** "See <owner>'s numbers + get updates" → creates
   `RoutineSubscription`.
5. **Save:** deep-copy into the viewer's routines (records `clonedFromRoutineId`).
6. **Live update:** when the owner finishes a workout on a shared routine, push
   to all subscribers via the existing Web Push pipeline ("Alex finished Push
   Day — see their numbers"). Immediate send (no QStash delay needed).

## Reuse

- Owner's per-exercise last session = the same logic already in
  `app/workout/[workoutId]/page.tsx` (last completed sets → weight/reps/RIR),
  generalized to "last completed session for routine R by profile P."
- Notifications = `lib/push.ts` `sendPushToProfile` per subscriber.

## Phases

- **Phase 0 — Foundations:** `Follow`, `RoutineSubscription`, `Routine`
  visibility/shareToken/clonedFrom; `prisma db push`; the `canViewRoutine` /
  `canViewNumbers` authz helper. No UI yet.
- **Phase 1 — Sharing + clone:** owner share toggle + link; follow graph
  (follow/unfollow, username search, profile page listing shared routines);
  shared-routine view (structure only); "Save to my routines".
- **Phase 2 — The numbers:** receiver opt-in subscription; shared view shows the
  owner's latest numbers gated by subscription; your-last-vs-theirs challenge UI.
- **Phase 3 — Live updates:** on finish, notify subscribers via Web Push; a
  simple activity feed of completions from people you follow.
- **Phase 4 — Polish:** clone attribution UI, subscription/follow management,
  privacy controls (stop sharing, remove follower, block), `Profile.displayName`.

## Open questions to resolve before Phase 1

- Can you subscribe to a routine's updates via link **without** following the
  person, or is following a prerequisite? (Leaning: link can grant view +
  subscribe without a follow; follow is for discovery.)
- Do owners need to approve followers (private accounts), or is following open?
- Should a cloned routine keep showing the original owner's numbers, or does it
  become fully your own (no link back)? (Leaning: clone is yours; the *original*
  shared routine is where you watch their numbers.)
