// app/actions/charts.ts
'use server';

import prisma from '../../lib/prisma';

export async function getExerciseHistory(profileId: string, exerciseId: string) {
  // Fetch all sets for a specific exercise for this user, ordered chronologically
  const sets = await prisma.set.findMany({
    where: {
      exerciseId: exerciseId,
      workout: { profileId: profileId }
    },
    include: {
      workout: { select: { date: true } }
    },
    orderBy: { workout: { date: 'asc' } }
  });

  // Group by date and calculate the max e1RM and total volume per session
  const historyMap = new Map();

  sets.forEach((set: any) => {
    const dateStr = set.workout.date.toISOString().split('T')[0];
    const e1RM = Math.round(set.weightLbs * (1 + set.reps / 30));
    const volume = set.weightLbs * set.reps; // simplified 1-set volume

    if (!historyMap.has(dateStr)) {
      historyMap.set(dateStr, { date: dateStr, maxE1RM: e1RM, totalVolume: volume });
    } else {
      const existing = historyMap.get(dateStr);
      existing.maxE1RM = Math.max(existing.maxE1RM, e1RM); // Track the best set
      existing.totalVolume += volume; // Accumulate volume
    }
  });

  return Array.from(historyMap.values());
}