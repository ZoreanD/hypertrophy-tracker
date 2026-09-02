// app/actions/charts.ts
'use server';

import prisma from '../../lib/prisma';
import { effectiveLoadOf, e1RMOf } from '../../lib/effectiveLoad';
import { countsForStrength } from '../../lib/setQuality';

export async function getExerciseHistory(profileId: string, exerciseId: string) {
  // Fetch all sets for a specific exercise for this user, ordered chronologically
  const [exercise, sets] = await Promise.all([
    prisma.exercise.findUnique({
      where: { id: exerciseId },
      select: { isAssisted: true, isBodyweight: true, weightIsPerSide: true },
    }),
    prisma.set.findMany({
      where: {
        exerciseId: exerciseId,
        workout: { profileId: profileId }
      },
      include: {
        workout: { select: { date: true } }
      },
      orderBy: { workout: { date: 'asc' } }
    }),
  ]);

  // Chart the load the muscle actually worked against. Using the raw selection
  // inverts assisted machines: a LOWER pin is less assistance and therefore a
  // harder set, so getting stronger would plot as a decline.
  const shape = {
    isAssisted: exercise?.isAssisted ?? false,
    isBodyweight: exercise?.isBodyweight ?? false,
    weightIsPerSide: exercise?.weightIsPerSide ?? false,
  };

  // Group by date and calculate the max e1RM and total volume per session
  const historyMap = new Map();

  sets.forEach((set: any) => {
    if (set.reps == null || (set.durationSeconds != null && set.durationSeconds > 0)) return;
    // Fatigued fragments still represent work, but must not drive maxE1RM.
    const strengthEligible = countsForStrength(set.setType);
    const dateStr = set.workout.date.toISOString().split('T')[0];
    const eff = effectiveLoadOf(set.weightLbs, shape, set.bodyweightLbs, set.assistanceWeightLbs);
    const e1RM = Math.round(e1RMOf(eff, set.reps));
    const volume = eff * set.reps; // simplified 1-set volume

    if (!historyMap.has(dateStr)) {
      historyMap.set(dateStr, { date: dateStr, maxE1RM: strengthEligible ? e1RM : 0, totalVolume: volume });
    } else {
      const existing = historyMap.get(dateStr);
      if (strengthEligible) existing.maxE1RM = Math.max(existing.maxE1RM, e1RM);
      existing.totalVolume += volume; // fragments DO count as volume
    }
  });

  return Array.from(historyMap.values());
}