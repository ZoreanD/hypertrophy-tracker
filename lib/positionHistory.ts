// Position-aware history.
//
// Where an exercise sits in a session changes what you can lift, so comparing a
// session where it ran LAST against one where it ran second isn't like for like.
// Triceps dips taken last — with triceps, chest and front delts already fatigued
// — will use less weight at genuine failure than the same movement done fresh.
// That is not a decline, and calling it one is the app's mistake, not the
// lifter's.
//
// Today the app only knows position CHANGED (>= 2 slots) and gives up. Keeping
// per-position history lets it say something useful instead: compare against the
// last time this exercise ran in a comparable slot, and only fall back to the
// most recent session (clearly labelled) when there's no positional match.

/** Slots within this distance count as "comparable" fatigue-wise. */
export const POSITION_TOLERANCE = 1;

export type PositionedSession<S> = {
  /** Where the exercise ran in that session (0-based). */
  executionOrder: number;
  date: Date;
  sets: S[];
};

export function isComparablePosition(a: number, b: number): boolean {
  return Math.abs(a - b) <= POSITION_TOLERANCE;
}

export type PositionMatch<S> = {
  session: PositionedSession<S>;
  /** true when the match ran in a comparable slot; false = fallback. */
  samePosition: boolean;
  /** Slot difference vs the current position (signed: + = later today). */
  slotDelta: number;
};

/**
 * Best comparison session for an exercise about to be performed at
 * `currentOrder`. Prefers the most recent session at a comparable position;
 * otherwise returns the most recent session flagged as not positionally
 * comparable, so callers can say so rather than pretending.
 */
export function findComparableSession<S>(
  sessionsNewestFirst: PositionedSession<S>[],
  currentOrder: number,
): PositionMatch<S> | null {
  if (sessionsNewestFirst.length === 0) return null;

  const match = sessionsNewestFirst.find((s) =>
    isComparablePosition(s.executionOrder, currentOrder));
  if (match) {
    return { session: match, samePosition: true, slotDelta: currentOrder - match.executionOrder };
  }

  const fallback = sessionsNewestFirst[0];
  return {
    session: fallback,
    samePosition: false,
    slotDelta: currentOrder - fallback.executionOrder,
  };
}

/** Human-readable note when the only history available is from another slot. */
export function positionCaveat(slotDelta: number): string {
  const later = slotDelta > 0;
  return later
    ? `That was ${Math.abs(slotDelta)} slot${Math.abs(slotDelta) === 1 ? '' : 's'} earlier in the session — you'll be more fatigued today, so expect a bit less.`
    : `That was ${Math.abs(slotDelta)} slot${Math.abs(slotDelta) === 1 ? '' : 's'} later in the session — you're fresher today, so you may have more in you.`;
}
