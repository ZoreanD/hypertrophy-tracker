// Which logged sets are valid evidence for which question.
//
// Not every set means the same thing. A drop-set fragment is taken in a
// deliberately fatigued state seconds after the previous set, so it says
// something about work done but nothing about strength: 1RM estimates should
// never be computed from a fatigued set, since accumulated fatigue understates
// true capacity. Epley is also only dependable roughly 2-10 reps and drifts
// upward beyond that, which is exactly where drop fragments and myo-rep minis
// live.
//
// So: fragments still count as VOLUME (drop sets produce hypertrophy comparable
// to straight sets — their advantage is time, not stimulus), but they never set
// an estimated 1RM and never decide whether the working load hit its rep range.

export const FATIGUED_FRAGMENT_TYPES = ['DROPSET_DROP', 'MYOREP_MINI'] as const;

/** Can this set be used to estimate strength (e1RM, best set, progression)? */
export function countsForStrength(setType: string | null | undefined): boolean {
  const t = setType ?? 'STRAIGHT';
  return !(FATIGUED_FRAGMENT_TYPES as readonly string[]).includes(t);
}

/**
 * Does this set speak to whether the WORKING load was appropriate for the rep
 * range? Only the unfatigued top sets do — a drop fragment hitting 8 reps at a
 * lighter load says nothing about the working weight.
 */
export function countsForRepRange(setType: string | null | undefined): boolean {
  const t = setType ?? 'STRAIGHT';
  return t === 'STRAIGHT' || t === 'DROPSET_PRIMARY' || t === 'MYOREP_ACTIVATION'
    || t === 'SUPERSET_A' || t === 'SUPERSET_B';
}

/**
 * Epley is dependable roughly 2-10 reps; past that endurance dominates and it
 * overestimates. Used to prefer a cleaner set when ranking, not to discard data.
 */
export function isReliableRepRangeFor1RM(reps: number): boolean {
  return reps >= 1 && reps <= 10;
}
