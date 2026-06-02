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
  notes?: string;
  sets: SetData[];
};

export async function logWorkout(data: WorkoutData) {
  try {
    // 1. Authenticate the User via Cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) throw new Error('Not authenticated');

    const decodedToken = await verifyToken(token);
    if (!decodedToken) throw new Error('Invalid token');

    // 2. Find THIS specific user's physical profile
    const profile = await prisma.profile.findUnique({
      where: { userId: decodedToken.userId },
    });

    if (!profile) throw new Error('Profile not found');

    // 3. Create the Workout and all its Sets in one safe transaction
    const workout = await prisma.workout.create({
      data: {
        profileId: profile.id, // Securely linked!
        focus: data.focus,
        durationMins: data.durationMins,
        notes: data.notes,
        // Prisma allows us to create the child 'sets' at the exact same time
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

    return { success: true, workoutId: workout.id };
  } catch (error) {
    console.error('Failed to log workout:', error);
    return { success: false, error: 'Failed to save workout data' };
  }
}