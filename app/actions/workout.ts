'use server';

import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../lib/auth';

type SetData = {
  exerciseId: string;
  weightLbs: number;
  reps: number;
  rir: number;
};

type WorkoutData = {
  focus: string;
  durationMins: number;
  currentWeightLbs: number;
  notes?: string;
  sets: SetData[];
};

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

  // Add direct workout burn (~5 kcal/min for weightlifting)
  const workoutBurn = durationMins * 5;
  const tdee = Math.round(bmr * activityMultiplier + workoutBurn);

  // Calorie adjustment based on goal
  // 1kg of tissue = ~7700 kcal spread over 7 days
  const dailyAdjustment = goal === 'MAINTAIN'
    ? 0
    : Math.round((weeklyGoalRate * 7700) / 7) * (goal === 'CUT' ? -1 : 1);

  const targetCalories = tdee + dailyAdjustment;

  // Higher protein when cutting to preserve muscle
  const proteinMultiplier = goal === 'CUT' ? 2.2 : 1.8;
  const targetProtein = Math.round(weightKg * proteinMultiplier);

  return { tdee, targetCalories, targetProtein };
}

export async function logWorkout(data: WorkoutData) {
  try {
    // 1. Authenticate the user via cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) throw new Error('Not authenticated');

    const decodedToken = await verifyToken(token);
    if (!decodedToken) throw new Error('Invalid token');

    // 2. Find this user's profile
    const profile = await prisma.profile.findUnique({
      where: { userId: decodedToken.userId },
    });
    if (!profile) throw new Error('Profile not found');

    // 3. Count workouts in last 7 days for activity multiplier
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentWorkoutCount = await prisma.workout.count({
      where: {
        profileId: profile.id,
        date: { gte: sevenDaysAgo },
      },
    });

    // 4. Calculate targets from real profile data
    const { tdee, targetCalories, targetProtein } = calculateTargets(
      data.currentWeightLbs,
      profile.heightCm,
      profile.birthDate,
      profile.gender,
      profile.currentGoal,
      profile.weeklyGoalRate,
      recentWorkoutCount,
      data.durationMins,
    );

    // 5. Save workout and sets
    const workout = await prisma.workout.create({
      data: {
        profileId: profile.id,
        focus: data.focus,
        durationMins: data.durationMins,
        notes: data.notes,
        sets: {
          create: data.sets.map((set) => ({
            exerciseId: set.exerciseId,
            weightLbs: set.weightLbs,
            reps: set.reps,
            rir: set.rir,
          })),
        },
      },
    });

    // 6. Upsert today's body metrics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.bodyMetric.upsert({
      where: {
        profileId_date: {
          profileId: profile.id,
          date: today,
        },
      },
      update: {
        weightKg: data.currentWeightLbs * 0.453592,
        calculatedTdee: tdee,
        targetCalories,
        targetProtein,
      },
      create: {
        profileId: profile.id,
        date: today,
        weightKg: data.currentWeightLbs * 0.453592,
        calculatedTdee: tdee,
        targetCalories,
        targetProtein,
      },
    });

    return { success: true, workoutId: workout.id };
  } catch (error) {
    console.error('Failed to log workout:', error);
    return { success: false, error: 'Failed to save workout data' };
  }
}