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

// Called when you tap a calendar day to start a workout
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
        durationMins: 0, // updated on finish
        date: new Date(scheduledDate),
      },
    });

    return { success: true, workoutId: workout.id };
  } catch (error) {
    console.error('Failed to start workout:', error);
    return { success: false };
  }
}

// Log a single set during the workout
export async function logSet(data: {
  workoutId: string;
  exerciseId: string;
  weightLbs: number;
  reps: number;
  rir: number;
  isWarmup: boolean;
  executionOrder: number;
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
      },
    });
    return { success: true, setId: set.id };
  } catch (error) {
    console.error('Failed to log set:', error);
    return { success: false };
  }
}

// Delete a set (if you logged wrong numbers)
export async function deleteSet(setId: string) {
  try {
    await prisma.set.delete({ where: { id: setId } });
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

// Get last session data for an exercise (position-aware)
export async function getExerciseHistory(
  exerciseId: string,
  profileId: string,
  currentExecutionOrder: number
) {
  try {
    // Get last 5 sessions for this exercise
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

    // Group by workout session
    const byWorkout = new Map<string, typeof recentSets>();
    recentSets.forEach((s) => {
      const id = s.workout.id;
      if (!byWorkout.has(id)) byWorkout.set(id, []);
      byWorkout.get(id)!.push(s);
    });

    const sessions = Array.from(byWorkout.values());
    const lastSession = sessions[0];

    // Check if exercise was in similar position last time
    const lastExecutionOrder = lastSession[0]?.executionOrder ?? 0;
    const positionChanged = Math.abs(lastExecutionOrder - currentExecutionOrder) >= 2;

    // Best set from last session (highest weight × reps)
    const bestSet = lastSession.reduce((best, s) =>
      s.weightLbs * s.reps > best.weightLbs * best.reps ? s : best
    );

    // Calculate e1RM using Epley formula
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

// Get progressive overload suggestion based on double progression
export function getProgressionSuggestion(history: {
  lastWeight: number;
  lastReps: number;
  lastRir: number;
  targetRepMax: number;
  targetRepMin: number;
  targetRir: number;
  positionChanged: boolean;
  lastExecutionOrder: number;
  currentExecutionOrder: number;
}) {
  const {
    lastWeight, lastReps, lastRir,
    targetRepMax, targetRepMin, targetRir,
    positionChanged, lastExecutionOrder, currentExecutionOrder,
  } = history;

  // Hit top of range at target RIR or better — suggest weight increase
  const hitTopOfRange = lastReps >= targetRepMax;
  const rirWasGood = lastRir >= targetRir;

  // Determine weight increment based on exercise type
  // We'll use a simple heuristic: lower body lifts get bigger jumps
  const isLowerBody = false; // caller can pass this
  const increment = 5; // default 5lbs, can be refined

  let suggestedWeight = lastWeight;
  let suggestion = '';
  let flag: 'increase' | 'maintain' | 'decrease' | 'context_change' = 'maintain';

  if (positionChanged) {
    const orderDiff = currentExecutionOrder - lastExecutionOrder;
    const direction = orderDiff > 0 ? 'later' : 'earlier';
    const expectedDrop = orderDiff > 0 ? '5–15%' : '';

    flag = 'context_change';
    suggestion = `Last session: exercise ${lastExecutionOrder + 1}. Today: exercise ${currentExecutionOrder + 1} (${direction} in session).${
      direction === 'later' ? ` Expect ~${expectedDrop} fewer reps at same weight.` : ' You may perform better fresh.'
    }`;
    suggestedWeight = lastWeight; // maintain weight on position change
  } else if (hitTopOfRange && rirWasGood) {
    suggestedWeight = lastWeight + increment;
    flag = 'increase';
    suggestion = `Last session: ${lastReps} reps @ ${lastWeight}lbs (${lastRir} RIR) — hit top of range. Try +${increment}lbs today.`;
  } else if (lastRir > targetRir + 1) {
    // Left too many reps in the tank — bigger jump possible
    suggestedWeight = lastWeight + increment * 2;
    flag = 'increase';
    suggestion = `Last session: ${lastReps} reps @ ${lastWeight}lbs (${lastRir} RIR) — too much left in reserve. Consider +${increment * 2}lbs.`;
  } else {
    flag = 'maintain';
    suggestion = `Last session: ${lastReps} reps @ ${lastWeight}lbs (${lastRir} RIR). Target ${targetRepMin}–${targetRepMax} reps. Maintain weight.`;
  }

  return { suggestedWeight, suggestion, flag };
}

// Finish the workout and calculate summary
export async function finishWorkout(workoutId: string, durationMins: number) {
  try {
    const profile = await getProfile();
    if (!profile) throw new Error('Not authenticated');

    // Get all sets for this workout
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

    // Update duration
    await prisma.workout.update({
      where: { id: workoutId },
      data: { durationMins },
    });

    // Build summary
    const exerciseSummaries = [];

    for (const routineEx of workout.routine?.exercises ?? []) {
      const setsForExercise = workout.sets.filter(
        (s) => s.exerciseId === routineEx.exerciseId
      );

      if (setsForExercise.length === 0) {
        exerciseSummaries.push({
          exerciseName: routineEx.exercise.name,
          status: 'skipped' as const,
          sets: [],
          progressionFlag: null,
        });
        continue;
      }

      // Get previous session for comparison
      const previousSets = await prisma.set.findMany({
        where: {
          exerciseId: routineEx.exerciseId,
          workout: { profileId: profile.id },
          isWarmup: false,
          NOT: { workoutId },
        },
        include: { workout: { select: { date: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const prevBest = previousSets.length > 0
        ? previousSets.reduce((b, s) => s.weightLbs * s.reps > b.weightLbs * b.reps ? s : b)
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

      let progressionFlag: 'improved' | 'maintained' | 'declined' | 'context_change' | 'first_time' = 'first_time';
      let progressionNote = '';

      if (!prevE1RM) {
        progressionFlag = 'first_time';
        progressionNote = 'First time logging this exercise.';
      } else if (positionChanged) {
        progressionFlag = 'context_change';
        const orderDiff = (currBest.executionOrder ?? 0) - (prevBest?.executionOrder ?? 0);
        progressionNote = `Exercise position changed (${orderDiff > 0 ? 'later' : 'earlier'} in session). Performance not directly comparable.`;
      } else if (currE1RM > prevE1RM) {
        progressionFlag = 'improved';
        progressionNote = `e1RM: ${prevE1RM}lbs → ${currE1RM}lbs (+${currE1RM - prevE1RM}lbs)`;
      } else if (currE1RM === prevE1RM) {
        progressionFlag = 'maintained';
        progressionNote = `e1RM held at ${currE1RM}lbs.`;
      } else {
        progressionFlag = 'declined';
        progressionNote = `e1RM: ${prevE1RM}lbs → ${currE1RM}lbs (${currE1RM - prevE1RM}lbs). Check position, rest, fatigue.`;
      }

      exerciseSummaries.push({
        exerciseName: routineEx.exercise.name,
        status: 'completed' as const,
        sets: setsForExercise.map((s) => ({
          weight: s.weightLbs,
          reps: s.reps,
          rir: s.rir,
        })),
        progressionFlag,
        progressionNote,
        currentE1RM: currE1RM,
        previousE1RM: prevE1RM,
      });
    }

    // Deload check: 3+ exercises with declining e1RM, not explained by position change
    const unexplainedDeclines = exerciseSummaries.filter(
      (e) => e.progressionFlag === 'declined'
    ).length;
    const totalCompleted = exerciseSummaries.filter(
      (e) => e.status === 'completed'
    ).length;

    const deloadRecommended = totalCompleted > 0 &&
      unexplainedDeclines / totalCompleted >= 0.5;

    revalidatePath('/dashboard');
    revalidatePath('/calendar');

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