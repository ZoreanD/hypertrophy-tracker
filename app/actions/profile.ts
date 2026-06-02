'use server';

import prisma from '../../lib/prisma';

export async function createProfile(data: {
  heightCm: number;
  weightLbs: number;
  age: number;
  gender: string;
  goal: string;
  weeklyGoalRate: number;
}) {
  try {
    // Calculate birthDate from age
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - data.age);

    await prisma.profile.create({
      data: {
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