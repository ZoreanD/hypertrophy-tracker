'use server';

import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../lib/auth';
import { revalidatePath } from 'next/cache';

async function getProfile() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;
  const decoded = await verifyToken(token);
  if (!decoded) return null;
  return prisma.profile.findUnique({ where: { userId: decoded.userId } });
}

export async function assignRoutineToDay(routineId: string, date: string) {
  try {
    const profile = await getProfile();
    if (!profile) throw new Error('Not authenticated');

    await prisma.scheduledWorkout.upsert({
      where: {
        profileId_date_routineId: {
          profileId: profile.id,
          date: new Date(date),
          routineId,
        },
      },
      update: {},
      create: {
        profileId: profile.id,
        routineId,
        date: new Date(date),
      },
    });

    revalidatePath('/calendar');
    return { success: true };
  } catch (error) {
    console.error('Failed to assign routine:', error);
    return { success: false };
  }
}

export async function removeRoutineFromDay(scheduledWorkoutId: string) {
  try {
    const profile = await getProfile();
    if (!profile) throw new Error('Not authenticated');

    await prisma.scheduledWorkout.delete({
      where: { id: scheduledWorkoutId },
    });

    revalidatePath('/calendar');
    return { success: true };
  } catch (error) {
    console.error('Failed to remove routine:', error);
    return { success: false };
  }
}

export async function getScheduledWorkouts(year: number, month: number) {
  try {
    const profile = await getProfile();
    if (!profile) return [];

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    return prisma.scheduledWorkout.findMany({
      where: {
        profileId: profile.id,
        date: { gte: start, lte: end },
      },
      include: {
        routine: {
          include: {
            exercises: {
              include: { exercise: true },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
      orderBy: { date: 'asc' },
    });
  } catch (error) {
    console.error('Failed to fetch scheduled workouts:', error);
    return [];
  }
}
export async function moveScheduledWorkout(scheduledWorkoutId: string, newDate: string) {
  try {
    const profile = await getProfile();
    if (!profile) throw new Error('Not authenticated');

    await prisma.scheduledWorkout.update({
      where: { id: scheduledWorkoutId },
      data: { date: new Date(newDate) },
    });

    revalidatePath('/calendar');
    return { success: true };
  } catch (error) {
    console.error('Failed to move scheduled workout:', error);
    return { success: false };
  }
}