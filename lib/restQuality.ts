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

import { e1RMOf, effectiveLoadOf, LoadShape } from './effectiveLoad';

/**
 * Expected fraction of set 1's reps, by set number (1-indexed).
 *
 * From a meta-analysis of 29 studies of >= 4 sets to failure at a FIXED load:
 * sets 2-6 came in at roughly 70, 55, 50, 45 and 45% of set 1. The loss is
 * curvilinear and flattens out after about 5 sets.
 */
export function expectedRetention(setNumber: number): number {
  if (setNumber <= 1) return 1;
  if (setNumber === 2) return 0.70;
  if (setNumber === 3) return 0.55;
  if (setNumber === 4) return 0.50;
  return 0.45; // sets 5+ plateau here
}

/**
 * Expected e1RM retention across consecutive straight sets.
 * At constant load, the 70%/55%/50%/45% rep drop translates to roughly
 * 92%, 88%, 85%, and 83% e1RM retention.
 */
export function expectedE1RMRetention(setNumber: number): number {
  if (setNumber <= 1) return 1.0;
  if (setNumber === 2) return 0.92;
  if (setNumber === 3) return 0.88;
  if (setNumber === 4) return 0.85;
  return 0.83;
}

/**
 * How far below the expected curve a set must land before it's "steep".
 * Sets taken shy of failure drop off LESS than the pooled figures (which come
 * from sets to failure), so a shortfall here is meaningful rather than routine.
 */
export const STEEP_MARGIN = 0.15;
export const STEEP_E1RM_MARGIN = 0.08;

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
  firstSetWeightLbs?: number;
  currentSetReps: number;
  currentSetWeightLbs?: number;
  setNumber: number; // 1-indexed position among straight sets
  actualRestSecs: number | null;
  plannedRestSecs: number;
  targetRepMin?: number | null;
  targetRepMax?: number | null;
  shape?: LoadShape;
  bodyweightLbs?: number | null;
  firstAssistanceWeightLbs?: number | null;
  currentAssistanceWeightLbs?: number | null;
}): RestVerdict {
  const {
    firstSetReps,
    firstSetWeightLbs,
    currentSetReps,
    currentSetWeightLbs,
    setNumber,
    actualRestSecs,
    plannedRestSecs,
    targetRepMin,
    shape = {},
    bodyweightLbs,
    firstAssistanceWeightLbs,
    currentAssistanceWeightLbs,
  } = params;

  if (setNumber < 2 || firstSetReps <= 0 || currentSetReps < 0) return { steep: false };
  if (actualRestSecs == null) return { steep: false };

  // 1. Did the lifter actually rush rest?
  const restWasShort = actualRestSecs < plannedRestSecs * SHORT_REST_RATIO;
  if (!restWasShort) return { steep: false };

  // 2. Guard: Autoregulated Target Rep Range Protection
  // If the lifter hit their prescribed rep range (e.g. 5-8 reps, and hit 5+),
  // the set executed inside the planned window. Never warn.
  if (targetRepMin != null && currentSetReps >= targetRepMin) {
    return { steep: false };
  }

  // 3. Load-Normalized Capacity (e1RM) Evaluation
  if (firstSetWeightLbs != null && currentSetWeightLbs != null) {
    const eff1 = effectiveLoadOf(firstSetWeightLbs, shape, bodyweightLbs, firstAssistanceWeightLbs);
    const effCurrent = effectiveLoadOf(currentSetWeightLbs, shape, bodyweightLbs, currentAssistanceWeightLbs);

    if (eff1 > 0) {
      const e1rm1 = e1RMOf(eff1, firstSetReps);
      const e1rmCurrent = e1RMOf(effCurrent, currentSetReps);

      if (e1rm1 > 0) {
        const retention = e1rmCurrent / e1rm1;
        const expected = expectedE1RMRetention(setNumber);

        // If e1RM retention is within normal fatigue margins, suppress warning
        if (retention >= expected - STEEP_E1RM_MARGIN && currentSetReps >= EFFECTIVE_REP_FLOOR) {
          return { steep: false };
        }

        // If weight was increased and e1RM stayed within normal range of Set 1, suppress warning
        if (effCurrent > eff1 * 1.01 && retention >= 0.88) {
          return { steep: false };
        }
      }
    }
  } else {
    // Fallback when weights are omitted: raw rep retention check
    const retention = currentSetReps / firstSetReps;
    const expected = expectedRetention(setNumber);
    if (retention >= expected - STEEP_MARGIN) return { steep: false };
  }

  const restMin = Math.round((plannedRestSecs / 60) * 10) / 10;
  const restDisplay = restMin < 1 ? `${plannedRestSecs}s` : `${restMin} min`;
  const actualDisplay = `${Math.round(actualRestSecs)}s`;

  return {
    steep: true,
    message: `${firstSetReps} → ${currentSetReps} reps on ${actualDisplay} rest. `
      + `That's a steep drop — try the full ${restDisplay} before the next set.`,
  };
}
