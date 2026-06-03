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
    // 1. Grab the secure cookie to identify the current user
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      throw new Error('Not authenticated');
    }

    // 2. Verify the token and extract the userId
    const decodedToken = await verifyToken(token);
    if (!decodedToken) {
      throw new Error('Invalid or expired token');
    }

    // 3. Clean up the data types from the form
    const numericAge = Number(data.age);
    const numericHeight = Number(data.heightCm);
    const numericWeeklyRate = Number(data.weeklyGoalRate);
    const weightKg = Number(data.weightLbs) / 2.20462; // Convert Lbs to Kg for standard storage
    
    // Force uppercase to strictly match the Prisma FitnessGoal Enum
    const safeGoal = data.goal.toUpperCase(); 

    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - numericAge);

    // 4. Create the profile AND the initial BodyMetric together
    await prisma.$transaction(async (tx) => {
      // Create the profile linked to the secure user
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

      // Insert the first weigh-in so the dashboard charts work immediately
      await tx.bodyMetric.create({
        data: {
          profileId: profile.id,
          weightKg: weightKg,
          targetCalories: 2500, // Safe baseline, can implement TDEE math later
          targetProtein: 150,   // Safe baseline
          calculatedTdee: 2500, 
        }
      });
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to create profile:', error);
    // Returning success false triggers the frontend "Something went wrong" message safely
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

    // Also log today's weight as a new body metric
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

    revalidatePath('/dashboard');
    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    console.error('Failed to update profile:', error);
    return { success: false };
  }
}