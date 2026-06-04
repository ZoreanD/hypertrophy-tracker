'use server';

import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../lib/auth';

// Add weeklyGoalRate to calculateMetrics data type
function calculateMetricsWithRate(data: {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  gender: string;
  goal: string;
  targetWeightKg?: number;
  weeklyGoalRate?: number;
  weeklyWorkouts?: number;
}) {
  const { weightKg, heightCm, ageYears, gender, goal, targetWeightKg, weeklyGoalRate = 0.5, weeklyWorkouts = 3 } = data;

  let bmr: number;
  if (gender === 'F') {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161;
  } else {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5;
  }

  let multiplier: number;
  if (weeklyWorkouts <= 1) multiplier = 1.2;
  else if (weeklyWorkouts <= 3) multiplier = 1.375;
  else if (weeklyWorkouts <= 5) multiplier = 1.55;
  else multiplier = 1.725;

  const tdee = Math.round(bmr * multiplier);

  let targetCalories: number;
  if (goal === 'CUT') {
    if (targetWeightKg && targetWeightKg < weightKg) {
      const kgToLose = weightKg - targetWeightKg;
      const deficitScale = Math.min(kgToLose / 5, 1);
      const deficit = Math.round(300 + deficitScale * 200);
      targetCalories = tdee - deficit;
    } else {
      targetCalories = tdee - 500;
    }
  } else if (goal === 'BULK') {
    targetCalories = tdee + 275;
  } else {
    targetCalories = tdee;
  }

  let proteinMultiplier: number;
  if (goal === 'CUT') proteinMultiplier = 2.2;
  else if (goal === 'BULK') proteinMultiplier = 1.8;
  else proteinMultiplier = 2.0;

  const targetProtein = Math.round(weightKg * proteinMultiplier);

  let weeksToGoal: number | null = null;
  if (targetWeightKg && weeklyGoalRate > 0) {
    const kgDiff = Math.abs(weightKg - targetWeightKg);
    weeksToGoal = kgDiff > 0 ? Math.round(kgDiff / weeklyGoalRate) : null;
  }

  return { calculatedTdee: tdee, targetCalories, targetProtein, weeksToGoal };
}

export async function createProfile(data: {
  heightCm: number | string;
  weightLbs: number | string;
  birthMonth: number | string;
  birthYear: number | string;
  gender: string;
  goal: string;
  weeklyGoalRate: number | string;
  targetWeightLbs?: number | string;
}) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) throw new Error('Not authenticated');

    const decodedToken = await verifyToken(token);
    if (!decodedToken) throw new Error('Invalid or expired token');

    const birthYear = Number(data.birthYear);
    const birthMonth = Number(data.birthMonth) - 1; // JS months are 0-indexed
    const birthDate = new Date(birthYear, birthMonth, 1);
    const now = new Date();
    const numericAge = now.getFullYear() - birthYear -
      (now.getMonth() < birthMonth ? 1 : 0);

    const numericHeight = Number(data.heightCm);
    const numericWeeklyRate = Number(data.weeklyGoalRate);
    const weightKg = Number(data.weightLbs) / 2.20462;
    const targetWeightKg = data.targetWeightLbs
      ? Number(data.targetWeightLbs) / 2.20462
      : undefined;
    const safeGoal = data.goal.toUpperCase();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { calculatedTdee, targetCalories, targetProtein } = calculateMetricsWithRate({
      weightKg,
      heightCm: numericHeight,
      ageYears: numericAge,
      gender: data.gender,
      goal: safeGoal,
      targetWeightKg,
      weeklyGoalRate: numericWeeklyRate,
    });

    await prisma.$transaction(async (tx) => {
      const profile = await tx.profile.create({
        data: {
          userId: decodedToken.userId,
          heightCm: numericHeight,
          birthDate,
          gender: data.gender,
          currentGoal: safeGoal as any,
          weeklyGoalRate: numericWeeklyRate,
          targetWeightLbs: data.targetWeightLbs ? Number(data.targetWeightLbs) : null,
        },
      });

      await tx.bodyMetric.create({
        data: {
          profileId: profile.id,
          date: today,
          weightKg,
          targetCalories,
          targetProtein,
          calculatedTdee,
        },
      });
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to create profile:', error);
    return { success: false };
  }
}

export async function updateProfile(data: {
  heightCm: number | string;
  weightLbs: number | string;
  birthMonth: number | string;
  birthYear: number | string;
  gender: string;
  goal: string;
  weeklyGoalRate: number | string;
  targetWeightLbs?: number | string;
}) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) throw new Error('Not authenticated');

    const decodedToken = await verifyToken(token);
    if (!decodedToken) throw new Error('Invalid or expired token');

    const birthYear = Number(data.birthYear);
    const birthMonth = Number(data.birthMonth) - 1;
    const birthDate = new Date(birthYear, birthMonth, 1);
    const now = new Date();
    const numericAge = now.getFullYear() - birthYear -
      (now.getMonth() < birthMonth ? 1 : 0);

    const numericHeight = Number(data.heightCm);
    const numericWeeklyRate = Number(data.weeklyGoalRate);
    const safeGoal = data.goal.toUpperCase();
    const weightKg = Number(data.weightLbs) / 2.20462;
    const targetWeightKg = data.targetWeightLbs
      ? Number(data.targetWeightLbs) / 2.20462
      : undefined;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.profile.update({
      where: { userId: decodedToken.userId },
      data: {
        heightCm: numericHeight,
        birthDate,
        gender: data.gender,
        currentGoal: safeGoal as any,
        weeklyGoalRate: numericWeeklyRate,
        targetWeightLbs: data.targetWeightLbs ? Number(data.targetWeightLbs) : null,
      },
    });

    const { calculatedTdee, targetCalories, targetProtein, weeksToGoal } = calculateMetricsWithRate({
      weightKg,
      heightCm: numericHeight,
      ageYears: numericAge,
      gender: data.gender,
      goal: safeGoal,
      targetWeightKg,
      weeklyGoalRate: numericWeeklyRate,
    });

    const profile = await prisma.profile.findUnique({
      where: { userId: decodedToken.userId },
    });

    if (profile) {
      await prisma.bodyMetric.upsert({
        where: {
          profileId_date: {
            profileId: profile.id,
            date: today,
          },
        },
        update: { weightKg, calculatedTdee, targetCalories, targetProtein },
        create: {
          profileId: profile.id,
          date: today,
          weightKg,
          calculatedTdee,
          targetCalories,
          targetProtein,
        },
      });
    }

    const { revalidatePath: revalidate } = await import('next/cache');
    revalidate('/dashboard');
    revalidate('/settings');
    return { success: true, weeksToGoal };
  } catch (error) {
    console.error('Failed to update profile:', error);
    return { success: false };
  }
}