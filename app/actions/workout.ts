// app/actions/workout.ts
'use server';

import prisma from '../../lib/prisma';
import { revalidatePath } from 'next/cache';

export async function logWorkout(
  profileId: string,
  currentWeightKg: number,
  focus: string,
  duration: number,
  sets: any[]
) {
  try {
    // 1. Save the Workout and all its Sets to the database
    await prisma.workout.create({
      data: {
        profileId,
        date: new Date(),
        focus,
        durationMins: duration,
        sets: {
          create: sets.map((s) => ({
            exerciseId: s.exerciseId,
            weightLbs: s.weightLbs,
            reps: s.reps,
            rir: s.rir,
          })),
        },
      },
    });

    // 2. Log today's bodyweight and update targets
    // (We will add the actual TDEE scientific math to this later!)
    await prisma.bodyMetric.create({
      data: {
        profileId,
        date: new Date(),
        weightKg: currentWeightKg,
        targetCalories: 2800, 
        targetProtein: Math.round(currentWeightKg * 2.2), // ~1g per lb of bodyweight
        calculatedTdee: 2500, 
      }
    });

    // 3. Clear the cache so the Dashboard shows the new numbers instantly
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error) {
    console.error("Failed to log workout:", error);
    return { success: false, error: "Database error" };
  }
}