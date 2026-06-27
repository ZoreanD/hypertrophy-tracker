# Social routine sharing — architecture & phased plan

A Strava-style layer: follow other users, view their shared routines, and
opt in to see their lift numbers + get a live update each time they finish
that routine. Optionally clone a shared routine into your own.

## Core principles

- **Identity = `Profile`.** All social edges hang off `Profile` (where the data
  lives). `User` keeps auth + unique `username`; we'll likely add a
  `displayName`/avatar to `Profile` later for nicer presentation.
- **Following (open, required) gates the numbers.** Following is one-way and
  needs no approval. You only ever see another user's lift numbers in the
  **Following** section, viewing *their* routine. Numbers never appear on your
  own copies (trial or saved).
- **Trial vs. own routine.** "Trialing" a followed routine creates a flagged
  clone (`isTrial = true`, numbers never copied) so you can schedule and train
  it with all the normal machinery. After you complete a trial workout you're
  prompted "Save as your routine?" — saying yes clears the flag and it's fully
  yours. A full clone is always structure-only (their numbers stripped).
- **Your trial numbers carry over (critical).** A trial *is* your routine from
  the start, so the workouts/sets you log while trialing attach to that routine
  id under your profile. "Save" only flips `isTrial` — the routine id is stable,
  so everything you logged during the trial stays attached and follows you. The
  ONLY data excluded is the sharer's numbers, which never enter your copy (they
  live on the sharer's side and are read live only in the Following section).
  This rules out a "clone-only-at-save" design, which would orphan trial logs.
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

// Routine visibility + clone attribution + trial flag (added to Routine).
enum RoutineVisibility { PRIVATE FOLLOWERS LINK }   // default PRIVATE
// Routine += visibility RoutineVisibility @default(PRIVATE)
//          shareToken String? @unique
//          clonedFromRoutineId String?   (+ self relation for "based on …")
//          isTrial Boolean @default(false)   // a flagged clone being test-driven
// A trial is a normal owned Routine with isTrial=true; "Save as my routine"
// just sets isTrial=false. Numbers are never copied into a clone or trial.

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
A viewer may **see the owner's numbers** only in the Following section, which
requires that they **follow** the owner (and the routine is shared). Numbers are
read live and shown only there — never on the viewer's trial/owned copies.
`RoutineSubscription` is reused purely for the optional "notify me when they
complete this routine" live update. Every shared read goes through one
`canViewRoutine(profileId, routine)` / `canViewNumbers(...)` helper — no
ad-hoc checks in pages.

## Key flows

1. **Share:** owner sets a routine's visibility (FOLLOWERS or LINK); LINK mints
   a `shareToken` → `/r/<token>`.
2. **Discover + follow:** search users by username → profile page → Follow (open,
   no approval).
3. **Following section (dashboard):** people you follow → their shared routines,
   each showing the owner's latest `weight × reps @ RIR` per exercise (dated),
   live. This is the *only* place their numbers appear.
4. **Trial:** from a followed routine, "Trial this" creates a flagged clone
   (`isTrial = true`, `clonedFromRoutineId` set, no numbers) in your account and
   lets you schedule it to your calendar like any routine. Your trial workouts
   show *your* numbers only.
5. **Save-after-completion:** when you finish a workout on a trial routine, prompt
   "Save as your routine?" → sets `isTrial = false`. It's now fully yours; the
   owner's numbers were never in it.
6. **Live update (optional per routine):** toggle "notify me when <owner>
   completes this" → `RoutineSubscription`. On the owner's finish, push to
   subscribers via the existing Web Push pipeline ("Alex finished Push Day").
   Immediate send (no QStash delay needed).

### Dashboard sections
- **Your routines** — owned, `isTrial = false`.
- **Trialing** — `isTrial = true`; test-drives with a "Save as my routine" path.
- **Following** — followed users + their shared routines with live numbers.

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

## Resolved decisions

- **Following is required** to see numbers, and following is **open** (no
  approval).
- A **clone/trial becomes fully yours**; numbers are stripped (never copied).
  You only watch the owner's numbers on *their* routine in the Following section.
- **Trial = flagged clone** (`isTrial`), promoted to a real routine via the
  post-completion "Save as your routine?" prompt.

## Phasing note

Phase 1 now includes the Follow graph + Following section + Trial flow (since
trialing is how you engage a followed routine). Numbers (Phase 2) light up the
Following section. Live-update push is Phase 3.
