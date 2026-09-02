// What the muscle actually worked against, as opposed to the number selected on
// the machine or bar.
//
//   assisted        — the pin COUNTERWEIGHTS bodyweight, so a lower selection is
//                     a HARDER set. Ranking these by raw weight picks the
//                     easiest set and reads progress as regression.
//   bodyweight+load — bodyweight plus whatever was added.
//   per-side        — what's loaded on one side, doubled.
//
// Shared so every consumer ranks sets the same way; they used to disagree.

export type LoadShape = {
  isAssisted?: boolean;
  isBodyweight?: boolean;
  weightIsPerSide?: boolean;
};

export function effectiveLoadOf(
  weightLbs: number,
  shape: LoadShape,
  bodyweightLbs?: number | null,
  assistanceWeightLbs?: number | null,
): number {
  if (shape.isAssisted && bodyweightLbs && assistanceWeightLbs) {
    return Math.max(0, bodyweightLbs - assistanceWeightLbs);
  }
  if (shape.isAssisted && bodyweightLbs) {
    return Math.max(0, bodyweightLbs - weightLbs);
  }
  if (shape.isBodyweight && bodyweightLbs) return bodyweightLbs + weightLbs;
  if (shape.weightIsPerSide) return weightLbs * 2;
  return weightLbs;
}

/** Epley. Ranks a heavy low-rep set against a lighter high-rep one. */
export function e1RMOf(effective: number, reps: number): number {
  if (reps <= 0) return 0;
  return effective * (1 + reps / 30);
}

/**
 * The set that best represents the session's strength — highest estimated 1RM,
 * NOT highest weight x reps. Single-set volume systematically favours the
 * lighter back-off set, so a heavy top set followed by an autoregulated drop
 * would be recorded as if the lighter load were the day's best.
 */
export function bestSetBy1RM<T extends { weightLbs: number; reps: number; bodyweightLbs?: number | null; assistanceWeightLbs?: number | null }>(
  sets: T[],
  shape: LoadShape,
): T | null {
  if (sets.length === 0) return null;
  return sets.reduce((best, s) => {
    const a = e1RMOf(effectiveLoadOf(s.weightLbs, shape, s.bodyweightLbs, s.assistanceWeightLbs), s.reps);
    const b = e1RMOf(effectiveLoadOf(best.weightLbs, shape, best.bodyweightLbs, best.assistanceWeightLbs), best.reps);
    return a > b ? s : best;
  });
}

/**
 * Heaviest EFFECTIVE load touched in a session. This is the honest answer to
 * "did you back off?" — dropping weight mid-session to stay in the rep range is
 * autoregulation, and shouldn't read as a reduced top-end load.
 */
export function topEffectiveLoad<T extends { weightLbs: number; reps: number; bodyweightLbs?: number | null; assistanceWeightLbs?: number | null }>(
  sets: T[],
  shape: LoadShape,
): number | null {
  if (sets.length === 0) return null;
  return Math.max(...sets.map((s) =>
    effectiveLoadOf(s.weightLbs, shape, s.bodyweightLbs, s.assistanceWeightLbs)));
}
