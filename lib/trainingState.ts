// Training state — how a session should be interpreted by progression and
// flagging.
//
// The problem this solves: the app used to treat every lighter session as a
// failure. A deliberate deload, or the first session back after two weeks off,
// would trip the "unexplained decline" detector and recommend a deload the
// lifter was already doing. Marking the session's intent up front lets the
// summary stay quiet when lower numbers are expected.

export type TrainingState = 'NORMAL' | 'DELOAD' | 'RETURNING';

/**
 * A break is measured from the last logged WORKING SET, never from the planned
 * calendar. Shuffling sessions around within a week (Mon/Tue/Wed -> Tue/Wed/Fri)
 * is normal training, not a layoff, and must never trigger return mode. Real
 * breaks show up as a clear outlier gap.
 */
export const RETURNING_GAP_DAYS = 7;

/** How many sessions return mode stays active before normal progression resumes. */
export const RETURNING_SESSIONS = 2;

/**
 * Fraction of previous working load to suggest coming back, scaled to how long
 * the break actually was.
 *
 * A single week off is not detraining: muscle mass is largely preserved (losses
 * generally begin around 2-3 weeks) and the early drop is mostly neural and
 * glycogen/water, so loads come back fast. The steep reductions quoted for
 * return-to-training protocols (50-60%) are for injury and multi-week layoffs,
 * and applying them to a one-week break leaves a lot on the table.
 */
export function returnLoadFactor(gapDays: number): number {
  if (gapDays < RETURNING_GAP_DAYS) return 1;
  if (gapDays <= 10) return 0.9;
  if (gapDays <= 14) return 0.825;
  if (gapDays <= 21) return 0.75;
  if (gapDays <= 35) return 0.65;
  return 0.55;
}

/** Extra RIR to leave on the first sessions back — stop short, rebuild fast. */
export function returnExtraRir(gapDays: number): number {
  if (gapDays < RETURNING_GAP_DAYS) return 0;
  return gapDays <= 10 ? 1 : 2;
}

/** Load multiplier for a deliberate deload session. */
export const DELOAD_LOAD_FACTOR = 0.55;
export const DELOAD_EXTRA_RIR = 2;

/** Whole days between two instants. */
export function daysBetween(earlier: Date, later: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / 86400000);
}

/**
 * Suggested load for an exercise given the session's state. Returns null when
 * nothing should change (normal training), so callers can leave the existing
 * progression logic untouched.
 */
export function suggestedLoad(
  state: TrainingState,
  lastWeight: number,
  gapDays: number | null,
): { weight: number; extraRir: number; reason: string } | null {
  if (state === 'DELOAD') {
    return {
      weight: roundToNearest(lastWeight * DELOAD_LOAD_FACTOR, 2.5),
      extraRir: DELOAD_EXTRA_RIR,
      reason: 'Deload — around half your usual load, well short of failure.',
    };
  }
  if (state === 'RETURNING' && gapDays != null) {
    const factor = returnLoadFactor(gapDays);
    if (factor >= 1) return null;
    return {
      weight: roundToNearest(lastWeight * factor, 2.5),
      extraRir: returnExtraRir(gapDays),
      reason: `${gapDays} days off — start around ${Math.round(factor * 100)}% and rebuild.`,
    };
  }
  return null;
}

export function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** States where lower numbers are expected, so declines must not be flagged. */
export function suppressesDeclineFlags(state: TrainingState): boolean {
  return state === 'DELOAD' || state === 'RETURNING';
}

export function stateLabel(state: TrainingState): string {
  return state === 'DELOAD' ? 'Deload'
    : state === 'RETURNING' ? 'Returning'
    : 'Normal';
}
