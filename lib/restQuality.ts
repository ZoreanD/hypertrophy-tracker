// Live between-sets read on whether short rest is dragging performance down.
//
// Reps falling across sets is normal fatigue — pooled data has set 3 landing
// near 55% of set 1, set 4 near 50%, set 5 near 45%, then levelling off. So a
// drop alone means nothing. But an UNUSUALLY steep drop taken on short rest is
// a different story: residual fatigue from the previous set holds back the next
// one, and lengthening the rest usually restores the reps.
//
// Both conditions are required. Flagging every drop would contradict the
// set-1 readiness hint, which correctly tells the lifter that drop-off is
// expected.

/**
 * Expected fraction of set 1's reps, by set number (1-indexed).
 *
 * From a meta-analysis of 29 studies of >= 4 sets to failure at a FIXED load:
 * sets 2-6 came in at roughly 70, 55, 50, 45 and 45% of set 1. The loss is
 * curvilinear and flattens out after about 5 sets.
 *
 * Two things follow. First, the same absolute drop means different things
 * depending on WHICH set it is: 8 -> 6 on set 2 is 75% (right on the curve),
 * while 8 -> 6 on set 3 is well ABOVE the 55% expected. Second, these figures
 * come from sets taken to failure — training at 1-2 RIR should drop off less
 * than this, so falling short of the curve is meaningful rather than routine.
 */
export function expectedRetention(setNumber: number): number {
  if (setNumber <= 1) return 1;
  if (setNumber === 2) return 0.70;
  if (setNumber === 3) return 0.55;
  if (setNumber === 4) return 0.50;
  return 0.45; // sets 5+ plateau here
}

/**
 * How far below the expected curve a set must land before it's "steep".
 * Sets taken shy of failure drop off LESS than the pooled figures (which come
 * from sets to failure), so a shortfall here is meaningful rather than routine.
 */
export const STEEP_MARGIN = 0.15;

/** Matches the post-workout under-resting threshold so the two never disagree. */
export const SHORT_REST_RATIO = 0.7;

/**
 * Reps above this still produce comparable growth per hard set, so falling out
 * of the prescribed rep range is not itself a problem — growth is similar from
 * roughly 5 to 30 reps when sets are taken near failure, and proximity to
 * failure matters more than the specific range. Below this the set drifts toward
 * a load/rep profile that buys more fatigue and joint stress per unit stimulus,
 * which IS worth mentioning.
 */
export const EFFECTIVE_REP_FLOOR = 5;

export type RestVerdict = { steep: true; message: string } | { steep: false };

export function assessRestDropoff(params: {
  firstSetReps: number;
  currentSetReps: number;
  setNumber: number;        // 1-indexed position among straight sets
  actualRestSecs: number | null;
  plannedRestSecs: number;
}): RestVerdict {
  const { firstSetReps, currentSetReps, setNumber, actualRestSecs, plannedRestSecs } = params;
  if (setNumber < 2 || firstSetReps <= 0 || currentSetReps < 0) return { steep: false };
  if (actualRestSecs == null) return { steep: false };

  const restWasShort = actualRestSecs < plannedRestSecs * SHORT_REST_RATIO;
  if (!restWasShort) return { steep: false };

  const retention = currentSetReps / firstSetReps;
  const expected = expectedRetention(setNumber);
  if (retention >= expected - STEEP_MARGIN) return { steep: false };

  const restMin = Math.round(plannedRestSecs / 60 * 10) / 10;
  return {
    steep: true,
    message: `${firstSetReps} → ${currentSetReps} reps on ${Math.round(actualRestSecs)}s rest. `
      + `That's a steep drop — try the full ${restMin < 1 ? `${plannedRestSecs}s` : `${restMin} min`} before the next set.`,
  };
}
