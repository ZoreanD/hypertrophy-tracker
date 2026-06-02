'use server';

import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../lib/auth';

export async function createProfile(data: {
  heightCm: number;
  weightLbs: number;
  age: number;
  gender: string;
  goal: string;
  weeklyGoalRate: number;
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

    // 3. Calculate birthDate from age
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - data.age);

    // 4. Create the profile and link it to the verified user!
    await prisma.profile.create({
      data: {
        userId: decodedToken.userId, // This is the missing piece!
        heightCm: data.heightCm,
        birthDate,
        gender: data.gender,
        currentGoal: data.goal as any,
        weeklyGoalRate: data.weeklyGoalRate,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to create profile:', error);
    return { success: false };
  }
}