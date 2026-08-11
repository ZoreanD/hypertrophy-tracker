// Bounds for a logged set.
//
// These are a safeguard against fat-fingers and garbage input, not a judgement
// about what anyone can lift — the ceilings sit well above any real lift so a
// legitimate set is never rejected. The point is to keep impossible values
// (negatives, NaN, 999999 lbs) out of the database, where they would quietly
// corrupt e1RM estimates, tonnage totals, and Year in Review.
//
// Shared by the client (immediate feedback) and the logSet server action (the
// authoritative check — every set-logging path goes through it).

export const SET_LIMITS = {
  // 0 is legitimate: bodyweight movements and fully-assisted machine settings.
  weightLbs: { min: 0, max: 2000 },
  // 0 is legitimate for time-based work, which records duration instead.
  reps: { min: 0, max: 500 },
  rir: { min: 0, max: 10 },
  durationSeconds: { min: 0, max: 14400 }, // 4 hours
} as const;

function checkNumber(
  label: string,
  value: number,
  bounds: { min: number; max: number },
  { integer = false }: { integer?: boolean } = {},
): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return `${label} must be a number.`;
  }
  if (value < bounds.min || value > bounds.max) {
    return `${label} must be between ${bounds.min} and ${bounds.max}.`;
  }
  if (integer && !Number.isInteger(value)) {
    return `${label} must be a whole number.`;
  }
  return null;
}

/** Returns an error message, or null when the set is acceptable. */
export function validateSet(data: {
  weightLbs: number;
  reps: number;
  rir: number;
  durationSeconds?: number | null;
  assistanceWeightLbs?: number | null;
  bodyweightLbs?: number | null;
}): string | null {
  return (
    checkNumber('Weight', data.weightLbs, SET_LIMITS.weightLbs) ??
    checkNumber('Reps', data.reps, SET_LIMITS.reps, { integer: true }) ??
    checkNumber('RIR', data.rir, SET_LIMITS.rir) ??
    (data.durationSeconds != null
      ? checkNumber('Duration', data.durationSeconds, SET_LIMITS.durationSeconds, { integer: true })
      : null) ??
    (data.assistanceWeightLbs != null
      ? checkNumber('Assistance weight', data.assistanceWeightLbs, SET_LIMITS.weightLbs)
      : null) ??
    (data.bodyweightLbs != null
      ? checkNumber('Bodyweight', data.bodyweightLbs, SET_LIMITS.weightLbs)
      : null)
  );
}
