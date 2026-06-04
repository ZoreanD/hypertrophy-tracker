'use server';

import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../lib/auth';

export async function createProfile(data: {
  heightCm: number | string;
  weightLbs: number | string;
  age: number | string;
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

    const numericAge = Number(data.age);
    const numericHeight = Number(data.heightCm);
    const numericWeeklyRate = Number(data.weeklyGoalRate);
    const weightKg = Number(data.weightLbs) / 2.20462;
    const safeGoal = data.goal.toUpperCase();

    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - numericAge);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
          targetCalories: 2500,
          targetProtein: 150,
          calculatedTdee: 2500,
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
  age: number | string;
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

    const numericAge = Number(data.age);
    const numericHeight = Number(data.heightCm);
    const numericWeeklyRate = Number(data.weeklyGoalRate);
    const safeGoal = data.goal.toUpperCase();

    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - numericAge);

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

    const weightKg = Number(data.weightLbs) / 2.20462;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
        update: { weightKg },
        create: {
          profileId: profile.id,
          date: today,
          weightKg,
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