'use server';

import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../lib/auth';
import { revalidatePath } from 'next/cache';

export type RoutineExerciseInput = {
  exerciseId: string;
  order: number;
  targetSets: number;
  targetRepMin: number;
  targetRepMax: number;
  targetRir: number;
  restTimerSecs: number;
  progressionStyle: string;
};

export async function createRoutine(data: {
  name: string;
  focus: string;
  notes?: string;
  weeklyFrequency?: number;
  exercises: RoutineExerciseInput[];
}) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) throw new Error('Not authenticated');

    const decodedToken = await verifyToken(token);
    if (!decodedToken) throw new Error('Invalid token');

    const profile = await prisma.profile.findUnique({
      where: { userId: decodedToken.userId },
    });
    if (!profile) throw new Error('Profile not found');

    await prisma.routine.create({
      data: {
        profileId: profile.id,
        name: data.name,
        focus: data.focus,
        notes: data.notes,
        weeklyFrequency: data.weeklyFrequency ?? 1,
        exercises: {
          create: data.exercises.map((ex) => ({
            exerciseId: ex.exerciseId,
            order: ex.order,
            targetSets: ex.targetSets,
            targetRepMin: ex.targetRepMin,
            targetRepMax: ex.targetRepMax,
            targetRir: ex.targetRir,
            restTimerSecs: ex.restTimerSecs,
            progressionStyle: ex.progressionStyle,
          })),
        },
      },
    });

    revalidatePath('/routines');
    return { success: true };
  } catch (error) {
    console.error('Failed to create routine:', error);
    return { success: false };
  }
}

export async function getRoutines() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return [];

    const decodedToken = await verifyToken(token);
    if (!decodedToken) return [];

    const profile = await prisma.profile.findUnique({
      where: { userId: decodedToken.userId },
    });
    if (!profile) return [];

    return await prisma.routine.findMany({
      where: { profileId: profile.id },
      include: {
        exercises: {
          include: { exercise: true },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    console.error('Failed to fetch routines:', error);
    return [];
  }
}
export async function updateRoutine(routineId: string, data: {
  name: string;
  focus: string;
  notes?: string;
  weeklyFrequency?: number;
  exercises: RoutineExerciseInput[];
}) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) throw new Error('Not authenticated');

    const decoded = await verifyToken(token);
    if (!decoded) throw new Error('Invalid token');

    const profile = await prisma.profile.findUnique({
      where: { userId: decoded.userId },
    });
    if (!profile) throw new Error('Profile not found');

    // Verify this routine belongs to this user
    const existing = await prisma.routine.findUnique({
      where: { id: routineId },
    });
    if (!existing || existing.profileId !== profile.id) {
      throw new Error('Not authorized');
    }

    // Delete all existing routine exercises and replace with new ones
    await prisma.$transaction(async (tx) => {
      await tx.routineExercise.deleteMany({
        where: { routineId },
      });

      await tx.routine.update({
        where: { id: routineId },
        data: {
          name: data.name,
          focus: data.focus,
          notes: data.notes,
          weeklyFrequency: data.weeklyFrequency ?? 1,
          exercises: {
            create: data.exercises.map((ex) => ({
              exerciseId: ex.exerciseId,
              order: ex.order,
              targetSets: ex.targetSets,
              targetRepMin: ex.targetRepMin,
              targetRepMax: ex.targetRepMax,
              targetRir: ex.targetRir,
              restTimerSecs: ex.restTimerSecs,
              progressionStyle: ex.progressionStyle,
            })),
          },
        },
      });
    });

    revalidatePath('/routines');
    return { success: true };
  } catch (error) {
    console.error('Failed to update routine:', error);
    return { success: false };
  }
}

export async function deleteRoutine(routineId: string) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) throw new Error('Not authenticated');

    const decoded = await verifyToken(token);
    if (!decoded) throw new Error('Invalid token');

    const profile = await prisma.profile.findUnique({
      where: { userId: decoded.userId },
    });
    if (!profile) throw new Error('Profile not found');

    const existing = await prisma.routine.findUnique({
      where: { id: routineId },
    });
    if (!existing || existing.profileId !== profile.id) {
      throw new Error('Not authorized');
    }

    await prisma.routine.delete({ where: { id: routineId } });

    revalidatePath('/routines');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete routine:', error);
    return { success: false };
  }
}