'use server';

import prisma from '../../lib/prisma';
import { revalidatePath } from 'next/cache';

function calculateTargets(
  weightLbs: number,
  heightCm: number,
  birthDate: Date,
  gender: string,
  goal: string,
  weeklyGoalRate: number,
  recentWorkoutCount: number,
  durationMins: number,
) {
  const weightKg = weightLbs * 0.453592;
  const age = Math.floor(
    (Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  );

  // Mifflin-St Jeor BMR
  let bmr = 10 * weightKg + 6.25 * heightCm - 5 * age;
  bmr = gender === 'F' ? bmr - 161 : bmr + 5;

  // Dynamic activity multiplier based on logged workout frequency
  let activityMultiplier = 1.2;
  if (recentWorkoutCount >= 5) activityMultiplier = 1.725;
  else if (recentWorkoutCount >= 3) activityMultiplier = 1.55;
  else if (recentWorkoutCount >= 1) activityMultiplier = 1.375;

  // Add direct workout burn (weightlifting ~5 kcal/min)
  const workoutBurn = durationMins * 5;
  const tdee = Math.round(bmr * activityMultiplier + workoutBurn);

  // Calorie adjustment based on goal
  // 1kg of tissue ≈ 7700 kcal, spread over 7 days
  const dailyAdjustment = goal === 'MAINTAIN'
    ? 0
    : Math.round((weeklyGoalRate * 7700) / 7) * (goal === 'CUT' ? -1 : 1);

  const targetCalories = tdee + dailyAdjustment;

  // Protein: higher end when cutting to preserve muscle (2.2g/kg), 
  // moderate when bulking (1.8g/kg)
  const proteinMultiplier = goal === 'CUT' ? 2.2 : 1.8;
  const targetProtein = Math.round(weightKg * proteinMultiplier);

  return { tdee, targetCalories, targetProtein };
}

export async function logWorkout(
  profileId: string,
  currentWeightLbs: number,
  focus: string,
  durationMins: number,
  sets: any[]
) {
  try {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
    });

    if (!profile) throw new Error('Profile not found');

    // Count workouts in last 7 days for activity multiplier
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentWorkoutCount = await prisma.workout.count({
      where: {
        profileId,
        date: { gte: sevenDaysAgo },
      },
    });

    const { tdee, targetCalories, targetProtein } = calculateTargets(
      currentWeightLbs,
      profile.heightCm,
      profile.birthDate,
      profile.gender,
      profile.currentGoal,
      profile.weeklyGoalRate,
      recentWorkoutCount,
      durationMins,
    );

    // Save workout and sets
    await prisma.workout.create({
      data: {
        profileId,
        date: new Date(),
        focus,
        durationMins,
        sets: {
          create: sets.map((s: any) => ({
            exerciseId: s.exerciseId,
            weightLbs: s.weightLbs,
            reps: s.reps,
            rir: s.rir,
          })),
        },
      },
    });

    // Upsert today's metrics (fixes the duplicate day crash)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.bodyMetric.upsert({
      where: {
        profileId_date: {
          profileId,
          date: today,
        },
      },
      update: {
        weightKg: currentWeightLbs * 0.453592,
        calculatedTdee: tdee,
        targetCalories,
        targetProtein,
      },
      create: {
        profileId,
        date: today,
        weightKg: currentWeightLbs * 0.453592,
        calculatedTdee: tdee,
        targetCalories,
        targetProtein,
      },
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Failed to log workout:', error);
    return { success: false, error: 'Database error' };
  }
}