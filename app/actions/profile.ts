'use server';

import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../lib/auth';

function calculateMetrics(data: {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  gender: string;
  goal: string;
  weeklyWorkouts?: number;
}) {
  const { weightKg, heightCm, ageYears, gender, goal, weeklyWorkouts = 3 } = data;

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
  if (goal === 'CUT') targetCalories = tdee - 500;
  else if (goal === 'BULK') targetCalories = tdee + 275;
  else targetCalories = tdee;

  let proteinMultiplier: number;
  if (goal === 'CUT') proteinMultiplier = 2.2;
  else if (goal === 'BULK') proteinMultiplier = 1.8;
  else proteinMultiplier = 2.0;

  const targetProtein = Math.round(weightKg * proteinMultiplier);

  return { calculatedTdee: tdee, targetCalories, targetProtein };
}

export async function createProfile(data: {
  heightCm: number | string;
  weightLbs: number | string;
  birthYear: number | string;
  gender: string;
  goal: string;
  weeklyGoalRate: number | string;
}) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) throw new Error('Not authenticated');

    const decodedToken = await verifyToken(token);
    if (!decodedToken) throw new Error('Invalid or expired token');

    const birthYear = Number(data.birthYear);
    const birthDate = new Date(birthYear, 0, 1);
    const numericAge = new Date().getFullYear() - birthYear;
    const numericHeight = Number(data.heightCm);
    const numericWeeklyRate = Number(data.weeklyGoalRate);
    const weightKg = Number(data.weightLbs) / 2.20462;
    const safeGoal = data.goal.toUpperCase();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { calculatedTdee, targetCalories, targetProtein } = calculateMetrics({
      weightKg,
      heightCm: numericHeight,
      ageYears: numericAge,
      gender: data.gender,
      goal: safeGoal,
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
  birthYear: number | string;
  gender: string;
  goal: string;
  weeklyGoalRate: number | string;
}) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) throw new Error('Not authenticated');

    const decodedToken = await verifyToken(token);
    if (!decodedToken) throw new Error('Invalid or expired token');

    const birthYear = Number(data.birthYear);
    const birthDate = new Date(birthYear, 0, 1);
    const numericAge = new Date().getFullYear() - birthYear;
    const numericHeight = Number(data.heightCm);
    const numericWeeklyRate = Number(data.weeklyGoalRate);
    const safeGoal = data.goal.toUpperCase();
    const weightKg = Number(data.weightLbs) / 2.20462;

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
      },
    });

    const { calculatedTdee, targetCalories, targetProtein } = calculateMetrics({
      weightKg,
      heightCm: numericHeight,
      ageYears: numericAge,
      gender: data.gender,
      goal: safeGoal,
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
    return { success: true };
  } catch (error) {
    console.error('Failed to update profile:', error);
    return { success: false };
  }
}