// Weekly volume model — how logged sets roll up into per-muscle-group set counts
// and how those compare to MEV/MAV landmarks.
//
// Counting rules (see the research notes below):
//   • A set credits its exercise's PRIMARY muscle group with 1.0 set.
//   • Each DISTINCT secondary muscle group is credited a fractional set
//     (INDIRECT_FRACTION, 0.5) — synergists get real but discounted stimulus.
//   • A group is credited at most once per set (a row hitting TRAPS_MID +
//     RHOMBOIDS, both "Upper Back", still only adds one 0.5), and never as both
//     primary and indirect for the same set.
//
// Landmarks (MEV = minimum effective volume, MAV = maximum adaptive volume) are
// weekly *hard sets*. They were originally derived largely from direct-set
// counts, so with fractional indirect volume now included the totals run a touch
// higher — the MEV/MAV values here are nudged to account for that. Tune freely.

export const INDIRECT_FRACTION = 0.5;

// Anatomical muscle enum → volume group. Granularity split out (2026-07):
// chest → upper vs mid/lower; back → lats (vertical pull) vs upper back
// (traps/rhomboids) vs lower back; delts → front vs side/rear.
export const MUSCLE_GROUP_MAP: Record<string, string> = {
  // Chest
  CHEST_UPPER: 'CHEST_UPPER',
  CHEST_MID_LOWER: 'CHEST_MID_LOWER',
  // Back — vertical pull (lats + teres, the "lat's little helper")
  LATS: 'LATS',
  TERES_MAJOR: 'LATS',
  // Back — upper/horizontal (traps + rhomboids)
  TRAPS_UPPER: 'UPPER_BACK',
  TRAPS_MID: 'UPPER_BACK',
  TRAPS_LOWER: 'UPPER_BACK',
  RHOMBOIDS: 'UPPER_BACK',
  // Back — erectors
  LOWER_BACK: 'LOWER_BACK',
  // Delts — front split from side/rear (front is over-fed by all pressing)
  FRONT_DELT: 'FRONT_DELT',
  SIDE_DELT: 'SIDE_REAR_DELT',
  REAR_DELT: 'SIDE_REAR_DELT',
  // Arms
  BICEPS_LONG_HEAD: 'BICEPS',
  BICEPS_SHORT_HEAD: 'BICEPS',
  BRACHIALIS: 'BICEPS',
  BRACHIORADIALIS: 'BICEPS',
  TRICEPS_LONG_HEAD: 'TRICEPS',
  TRICEPS_LATERAL_HEAD: 'TRICEPS',
  TRICEPS_MEDIAL_HEAD: 'TRICEPS',
  FOREARMS: 'FOREARMS',
  // Legs
  QUAD_VASTUS_LATERALIS: 'QUADS',
  QUAD_VASTUS_MEDIALIS: 'QUADS',
  QUAD_RECTUS_FEMORIS: 'QUADS',
  HAMSTRING_BICEPS_FEMORIS: 'HAMSTRINGS',
  HAMSTRING_MEDIAL: 'HAMSTRINGS',
  GLUTE_MAX: 'GLUTES',
  GLUTE_MED: 'GLUTES',
  HIP_ABDUCTOR: 'GLUTES',
  HIP_ADDUCTOR: 'GLUTES',
  GASTROCNEMIUS: 'CALVES',
  SOLEUS: 'CALVES',
  // Core
  ABS: 'ABS',
  OBLIQUES: 'ABS',
};

// Ordered top-down (push, pull, delts, arms, legs, core) — drives display order.
export const VOLUME_LANDMARKS: Record<string, { mev: number; mav: number; label: string }> = {
  CHEST_UPPER: { mev: 5, mav: 12, label: 'Upper Chest' },
  CHEST_MID_LOWER: { mev: 6, mav: 14, label: 'Mid/Lower Chest' },
  LATS: { mev: 8, mav: 18, label: 'Lats' },
  UPPER_BACK: { mev: 8, mav: 20, label: 'Upper Back' },
  LOWER_BACK: { mev: 2, mav: 8, label: 'Lower Back' },
  SIDE_REAR_DELT: { mev: 8, mav: 22, label: 'Side/Rear Delts' },
  FRONT_DELT: { mev: 0, mav: 8, label: 'Front Delts' },
  BICEPS: { mev: 6, mav: 14, label: 'Biceps' },
  TRICEPS: { mev: 4, mav: 12, label: 'Triceps' },
  QUADS: { mev: 8, mav: 18, label: 'Quads' },
  HAMSTRINGS: { mev: 6, mav: 16, label: 'Hamstrings' },
  GLUTES: { mev: 4, mav: 12, label: 'Glutes' },
  CALVES: { mev: 6, mav: 16, label: 'Calves' },
  ABS: { mev: 0, mav: 12, label: 'Abs' },
};

export function groupOf(muscle: string): string {
  return MUSCLE_GROUP_MAP[muscle] ?? muscle;
}

// Credit one logged set into an accumulator: 1.0 to the primary group, then
// INDIRECT_FRACTION to each distinct other group its secondary muscles hit.
export function addSetVolume(
  acc: Record<string, number>,
  primaryMuscle: string,
  secondaryMuscles: string[] | null | undefined,
): void {
  const primaryGroup = groupOf(primaryMuscle);
  acc[primaryGroup] = (acc[primaryGroup] ?? 0) + 1;
  const credited = new Set<string>([primaryGroup]);
  for (const sec of secondaryMuscles ?? []) {
    const g = groupOf(sec);
    if (credited.has(g)) continue;
    credited.add(g);
    acc[g] = (acc[g] ?? 0) + INDIRECT_FRACTION;
  }
}
