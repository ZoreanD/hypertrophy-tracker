// What counts as a genuine performance decline.
//
// The old rule was: >= 50% of a session's exercises flagged 'declined' => tell
// the lifter to deload. That fires off a single rough day, which the reliability
// data says is mostly noise — 1RM test-retest sits around a 4.2% median
// coefficient of variation (range 0.5-12.1%), and velocity-based measures run
// 2.4-9.7% between days. A swing of a few percent between sessions is normal
// variation, not information.
//
// It also conflated two different things:
//   DECLINE  — performance actually falling. A recognised reactive deload
//              trigger; left unaddressed it's the road to non-functional
//              overreaching.
//   PLATEAU  — performance holding steady. NOT a warning sign. Progress is
//              training-age dependent: intermediates progress week to week,
//              advanced lifters block to block, and most of an advanced
//              lifter's time is spent on an apparent plateau. On an isolation
//              lift the smallest jump can be >10% of the load, so holding for
//              weeks is waiting for a big relative increment, not stalling.
//
// The literature has no agreed operational definition of a deload trigger, so
// these thresholds are deliberately conservative: better to miss a marginal
// call than to tell someone to deload because they slept badly once.

/** Below this, a session-to-session change is indistinguishable from noise. */
export const NOISE_FLOOR_PCT = 5;

/** A decline must persist this many consecutive sessions to count. */
export const DECLINE_PERSISTENCE = 2;

/** Weeks of no meaningful progress before flagging a plateau (advanced-lifter cadence). */
export const PLATEAU_WEEKS = 5;

export type SessionPoint = {
  /** YYYY-MM-DD */
  day: string;
  /** Best e1RM on effective load from strength-eligible sets. */
  e1RM: number;
  /** Whether this session is positionally comparable to the others. */
  samePosition?: boolean;
};

export function pctChange(from: number, to: number): number {
  if (from <= 0) return 0;
  return ((to - from) / from) * 100;
}

/** A drop big enough to exceed measurement noise. */
export function isRealDrop(from: number, to: number): boolean {
  return pctChange(from, to) <= -NOISE_FLOOR_PCT;
}

export type TrendVerdict =
  | { kind: 'insufficient' }
  | { kind: 'progressing' }
  | { kind: 'declining'; sessions: number; pct: number }
  | { kind: 'plateau'; weeks: number };

/**
 * Verdict for one exercise from its session history (NEWEST FIRST).
 *
 * Only positionally comparable sessions are considered — comparing a session
 * where the exercise ran last against one where it ran fresh is exactly the
 * false positive this is meant to avoid.
 */
export function assessTrend(points: SessionPoint[]): TrendVerdict {
  const usable = points.filter((p) => p.samePosition !== false && p.e1RM > 0);
  if (usable.length < DECLINE_PERSISTENCE + 1) return { kind: 'insufficient' };

  // Declining: every one of the last DECLINE_PERSISTENCE steps is a real drop.
  let consecutive = 0;
  for (let i = 0; i < Math.min(DECLINE_PERSISTENCE, usable.length - 1); i++) {
    if (isRealDrop(usable[i + 1].e1RM, usable[i].e1RM)) consecutive++;
    else break;
  }
  if (consecutive >= DECLINE_PERSISTENCE) {
    return {
      kind: 'declining',
      sessions: consecutive,
      pct: Math.round(pctChange(usable[consecutive].e1RM, usable[0].e1RM)),
    };
  }

  // Plateau is judged over a BLOCK, never week to week.
  const newest = usable[0];
  const oldest = usable[usable.length - 1];
  const weeks = Math.round(
    (new Date(newest.day + 'T12:00:00Z').getTime()
      - new Date(oldest.day + 'T12:00:00Z').getTime()) / (7 * 86400000));
  if (weeks >= PLATEAU_WEEKS && Math.abs(pctChange(oldest.e1RM, newest.e1RM)) < NOISE_FLOOR_PCT) {
    return { kind: 'plateau', weeks };
  }

  return { kind: 'progressing' };
}
