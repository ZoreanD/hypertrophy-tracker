// Escalating "you haven't trained in a while" nudges.
//
// Thresholds mirror what actually happens physiologically, so the message earns
// its interruption instead of just nagging:
//   7d  — nothing is lost yet; this is the cheap moment to restart.
//   14d — the edge where real lean-mass loss begins (earlier drops are mostly
//         neural and glycogen/water, which come back within a session or two).
//   21d — measurable tissue loss; the return plan genuinely changes.
//   30d — treat it as a rebuild, not a resumption.
//
// A profile is nudged at most once per threshold (Profile.layoffNudgeDays), and
// the whole thing resets the moment a working set is logged.

export const LAYOFF_THRESHOLDS = [7, 14, 21, 30] as const;

export type LayoffNudge = { threshold: number; title: string; body: string };

const NUDGES: Record<number, LayoffNudge> = {
  7: {
    threshold: 7,
    title: "A week since your last set",
    body: "Nothing's lost yet — strength and muscle are both intact at this point. Come back at your usual weights, just leave an extra rep in reserve on the first session.",
  },
  14: {
    threshold: 14,
    title: 'Two weeks off — time to plan the return',
    body: 'This is where actual muscle loss starts; up to now it was mostly water and nervous-system rust. Come back around 80–85% of your old loads with 2 reps in reserve, and you should be back to full within a couple of sessions.',
  },
  21: {
    threshold: 21,
    title: 'Three weeks off',
    body: 'Expect some real size and strength loss now — and expect it to come back fast, since regaining is much quicker than building. Start near 75% of your previous loads and add 5–10% a week rather than testing where you are.',
  },
  30: {
    threshold: 30,
    title: 'A month out — rebuild, don\'t resume',
    body: 'Start around 60% of your old numbers, keep the first week to about three sessions, and stop well short of failure. Muscle memory is real: this comes back far faster than it took to build.',
  },
};

/** The highest threshold crossed by `gapDays` that hasn't been sent yet. */
export function nudgeFor(gapDays: number, alreadySent: number | null): LayoffNudge | null {
  const crossed = LAYOFF_THRESHOLDS.filter((t) => gapDays >= t);
  if (crossed.length === 0) return null;
  const highest = crossed[crossed.length - 1];
  if (alreadySent != null && alreadySent >= highest) return null;
  return NUDGES[highest];
}
