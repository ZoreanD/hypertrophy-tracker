'use server';

import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../lib/auth';

async function getProfile() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;
  const decoded = await verifyToken(token);
  if (!decoded) return null;
  return prisma.profile.findUnique({ where: { userId: decoded.userId } });
}

export async function startWorkout(routineId: string, scheduledDate: string) {
  try {
    const profile = await getProfile();
    if (!profile) throw new Error('Not authenticated');

    const routine = await prisma.routine.findUnique({
      where: { id: routineId },
      include: {
        exercises: {
          include: { exercise: true },
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!routine) throw new Error('Routine not found');

    const workout = await prisma.workout.create({
      data: {
        profileId: profile.id,
        routineId,
        focus: routine.focus ?? routine.name,
        durationMins: 0,
        date: new Date(scheduledDate),
      },
    });

    return { success: true, workoutId: workout.id };
  } catch (error) {
    console.error('Failed to start workout:', error);
    return { success: false };
  }
}

export async function logSet(data: {
  workoutId: string;
  exerciseId: string;
  weightLbs: number;
  reps: number;
  rir: number;
  isWarmup: boolean;
  executionOrder: number;
  setType?: string;
  setGroupId?: string | null;
}) {
  try {
    const set = await prisma.set.create({
      data: {
        workoutId: data.workoutId,
        exerciseId: data.exerciseId,
        weightLbs: data.weightLbs,
        reps: data.reps,
        rir: data.rir,
        isWarmup: data.isWarmup,
        executionOrder: data.executionOrder,
        setType: data.setType ?? 'STRAIGHT',
        setGroupId: data.setGroupId ?? null,
      },
    });
    return { success: true, setId: set.id };
  } catch (error) {
    console.error('Failed to log set:', error);
    return { success: false };
  }
}

export async function deleteSet(setId: string) {
  try {
    await prisma.set.delete({ where: { id: setId } });
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function getExerciseHistory(
  exerciseId: string,
  profileId: string,
  currentExecutionOrder: number
) {
  try {
    const recentSets = await prisma.set.findMany({
      where: {
        exerciseId,
        workout: { profileId },
        isWarmup: false,
      },
      include: {
        workout: { select: { date: true, id: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    if (recentSets.length === 0) return null;

    const byWorkout = new Map<string, typeof recentSets>();
    recentSets.forEach((s) => {
      const id = s.workout.id;
      if (!byWorkout.has(id)) byWorkout.set(id, []);
      byWorkout.get(id)!.push(s);
    });

    const sessions = Array.from(byWorkout.values());
    const lastSession = sessions[0];
    const lastExecutionOrder = lastSession[0]?.executionOrder ?? 0;
    const positionChanged = Math.abs(lastExecutionOrder - currentExecutionOrder) >= 2;

    const bestSet = lastSession.reduce((best, s) =>
      s.weightLbs * s.reps > best.weightLbs * best.reps ? s : best
    );

    const e1RM = Math.round(bestSet.weightLbs * (1 + bestSet.reps / 30));

    return {
      lastWeight: bestSet.weightLbs,
      lastReps: bestSet.reps,
      lastRir: bestSet.rir,
      lastDate: lastSession[0].workout.date,
      lastExecutionOrder,
      positionChanged,
      currentExecutionOrder,
      e1RM,
      allSets: lastSession,
    };
  } catch (error) {
    console.error('Failed to get exercise history:', error);
    return null;
  }
}

export async function finishWorkout(workoutId: string, durationMins: number) {
  try {
    const profile = await getProfile();
    if (!profile) throw new Error('Not authenticated');

    const workout = await prisma.workout.findUnique({
      where: { id: workoutId },
      include: {
        sets: {
          include: { exercise: true },
          where: { isWarmup: false },
        },
        routine: {
          include: {
            exercises: {
              include: { exercise: true },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!workout) throw new Error('Workout not found');

    await prisma.workout.update({
      where: { id: workoutId },
      data: { durationMins },
    });

    const exerciseSummaries = [];

    for (const routineEx of workout.routine?.exercises ?? []) {
      const setsForExercise = workout.sets.filter(
        (s) => s.exerciseId === routineEx.exerciseId
      );

      if (setsForExercise.length === 0) {
        exerciseSummaries.push({
          exerciseName: routineEx.exercise.name,
          status: 'skipped' as const,
          planned: {
            sets: routineEx.targetSets,
            repMin: routineEx.targetRepMin,
            repMax: routineEx.targetRepMax,
            rir: routineEx.targetRir,
          },
          sets: [],
          progressionFlag: null,
          progressionNote: '',
        });
        continue;
      }

      const previousSets = await prisma.set.findMany({
        where: {
          exerciseId: routineEx.exerciseId,
          workout: { profileId: profile.id },
          isWarmup: false,
          NOT: { workoutId },
        },
        include: { workout: { select: { date: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      // Match set type for fair comparison
      const matchingSetType = setsForExercise[0]?.setType ?? 'STRAIGHT';
      const prevMatchingSets = previousSets.filter((s) => s.setType === matchingSetType);

      const prevBest = prevMatchingSets.length > 0
        ? prevMatchingSets.reduce((b, s) => s.weightLbs * s.reps > b.weightLbs * b.reps ? s : b)
        : null;

      const currBest = setsForExercise.reduce((b, s) =>
        s.weightLbs * s.reps > b.weightLbs * b.reps ? s : b
      );

      const currE1RM = Math.round(currBest.weightLbs * (1 + currBest.reps / 30));
      const prevE1RM = prevBest
        ? Math.round(prevBest.weightLbs * (1 + prevBest.reps / 30))
        : null;

      const positionChanged = prevBest
        ? Math.abs((prevBest.executionOrder ?? 0) - (currBest.executionOrder ?? 0)) >= 2
        : false;

      // For volume-based set types, compare total volume load
      const currTotalVolume = setsForExercise.reduce((sum, s) => sum + s.weightLbs * s.reps, 0);
      const prevTotalVolume = prevMatchingSets.reduce((sum, s) => sum + s.weightLbs * s.reps, 0);

      const isGrouped = ['SUPERSET_A', 'SUPERSET_B', 'MYOREP_ACTIVATION', 'MYOREP_MINI', 'DROPSET_PRIMARY', 'DROPSET_DROP'].includes(matchingSetType);
      const isVolumeBased = ['MYOREP_MINI', 'DROPSET_DROP'].includes(matchingSetType);

      let progressionFlag: 'improved' | 'maintained' | 'declined' | 'context_change' | 'first_time' = 'first_time';
      let progressionNote = '';

      const contextTag = isGrouped ? ` (${matchingSetType.replace(/_/g, ' ').toLowerCase()})` : '';

      if (!prevE1RM && prevTotalVolume === 0) {
        progressionFlag = 'first_time';
        progressionNote = `First time logging this exercise${contextTag}.`;
      } else if (positionChanged && !isGrouped) {
        progressionFlag = 'context_change';
        const orderDiff = (currBest.executionOrder ?? 0) - (prevBest?.executionOrder ?? 0);
        progressionNote = `Exercise position changed (${orderDiff > 0 ? 'later' : 'earlier'} in session). Performance not directly comparable.`;
      } else if (isVolumeBased) {
        if (currTotalVolume > prevTotalVolume) {
          progressionFlag = 'improved';
          progressionNote = `Total volume: ${Math.round(prevTotalVolume)}lbs → ${Math.round(currTotalVolume)}lbs (+${Math.round(currTotalVolume - prevTotalVolume)}lbs)${contextTag}.`;
        } else if (currTotalVolume === prevTotalVolume) {
          progressionFlag = 'maintained';
          progressionNote = `Total volume held at ${Math.round(currTotalVolume)}lbs${contextTag}.`;
        } else {
          progressionFlag = 'declined';
          progressionNote = `Total volume: ${Math.round(prevTotalVolume)}lbs → ${Math.round(currTotalVolume)}lbs${contextTag}.`;
        }
      } else if (currE1RM && prevE1RM) {
        if (currE1RM > prevE1RM) {
          progressionFlag = 'improved';
          progressionNote = `e1RM: ${prevE1RM}lbs → ${currE1RM}lbs (+${currE1RM - prevE1RM}lbs)${contextTag}.`;
        } else if (currE1RM === prevE1RM) {
          progressionFlag = 'maintained';
          progressionNote = `e1RM held at ${currE1RM}lbs${contextTag}.`;
        } else {
          progressionFlag = 'declined';
          progressionNote = `e1RM: ${prevE1RM}lbs → ${currE1RM}lbs (${currE1RM - prevE1RM}lbs)${contextTag}. Check position, rest, fatigue.`;
        }
      }

      exerciseSummaries.push({
        exerciseName: routineEx.exercise.name,
        status: 'completed' as const,
        planned: {
          sets: routineEx.targetSets,
          repMin: routineEx.targetRepMin,
          repMax: routineEx.targetRepMax,
          rir: routineEx.targetRir,
        },
        sets: setsForExercise.map((s) => ({
          weight: s.weightLbs,
          reps: s.reps,
          rir: s.rir,
          setType: s.setType,
        })),
        progressionFlag,
        progressionNote,
        currentE1RM: currE1RM,
        previousE1RM: prevE1RM,
      });
    }

    const unexplainedDeclines = exerciseSummaries.filter(
      (e) => e.progressionFlag === 'declined'
    ).length;
    const totalCompleted = exerciseSummaries.filter(
      (e) => e.status === 'completed'
    ).length;

    const deloadRecommended = totalCompleted > 0 &&
      unexplainedDeclines / totalCompleted >= 0.5;

    const { revalidatePath: revalidate } = await import('next/cache');
    revalidate('/dashboard');
    revalidate('/calendar');

    return {
      success: true,
      summary: {
        exerciseSummaries,
        deloadRecommended,
        totalSets: workout.sets.length,
        durationMins,
      },
    };
  } catch (error) {
    console.error('Failed to finish workout:', error);
    return { success: false };
  }
}

export async function getSubstituteExercises(
  exerciseId: string,
  primaryMuscle: string,
  movementPattern: string
) {
  try {
    const substitutes = await prisma.exercise.findMany({
      where: {
        primaryMuscle: primaryMuscle as any,
        movementPattern: movementPattern as any,
        NOT: { id: exerciseId },
      },
      select: {
        id: true,
        name: true,
        primaryMuscle: true,
        equipment: true,
        movementPattern: true,
      },
      orderBy: { name: 'asc' },
    });
    return { success: true, substitutes };
  } catch (error) {
    console.error('Failed to fetch substitutes:', error);
    return { success: true, substitutes: [] };
  }
}