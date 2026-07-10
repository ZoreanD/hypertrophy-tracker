'use server';

import prisma from '../../lib/prisma';
import { Prisma } from '@prisma/client';
import { cookies } from 'next/headers';
import { verifyToken } from '../../lib/auth';
import { revalidatePath } from 'next/cache';
import { getTodayBoundsUTC } from '../../lib/today';

async function getProfile() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;
  const decoded = await verifyToken(token);
  if (!decoded) return null;
  return prisma.profile.findUnique({ where: { userId: decoded.userId } });
}

// Calculate effective load for assisted/bodyweight exercises
function getEffectiveLoad(weightLbs: number, bodyweightLbs: number | null, assistanceWeightLbs: number | null, isAssisted: boolean, isBodyweight: boolean, weightIsPerSide?: boolean): number {
  if (isAssisted && bodyweightLbs && assistanceWeightLbs) {
    return bodyweightLbs - assistanceWeightLbs;
  }
  if (isBodyweight && bodyweightLbs) {
    return bodyweightLbs + weightLbs;
  }
  if (weightIsPerSide) {
    return weightLbs * 2;
  }
  return weightLbs;
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

    // Idempotent: return existing workout if one already exists for this routine+date
    const existingWorkout = await prisma.workout.findFirst({
      where: {
        profileId: profile.id,
        routineId,
        date: new Date(scheduledDate),
      },
      orderBy: { date: 'desc' },
    });

    if (existingWorkout) {
      return { success: true, workoutId: existingWorkout.id };
    }

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
  side?: string | null;
  assistanceWeightLbs?: number | null;
  bodyweightLbs?: number | null;
  durationSeconds?: number | null;
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
        side: data.side ?? null,
        assistanceWeightLbs: data.assistanceWeightLbs ?? null,
        bodyweightLbs: data.bodyweightLbs ?? null,
        durationSeconds: data.durationSeconds ?? null,
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

// Get user's current bodyweight for assisted/bodyweight exercise logging
export async function getCurrentBodyweight(profileId: string): Promise<number | null> {
  try {
    const metric = await prisma.bodyMetric.findFirst({
      where: { profileId },
      orderBy: { date: 'desc' },
    });
    return metric ? Math.round(metric.weightKg * 2.20462 * 10) / 10 : null;
  } catch {
    return null;
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
        exercise: { select: { isAssisted: true, isBodyweight: true, isTimeBased: true, equipment: true, weightIsPerSide: true } },
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

    // Time-based exercises store reps=0, so rank by duration, not weight×reps.
    const isTimeBased = lastSession[0]?.exercise?.isTimeBased ?? false;
    const bestSet = lastSession.reduce((best, s) =>
      isTimeBased
        ? ((s.durationSeconds ?? 0) > (best.durationSeconds ?? 0) ? s : best)
        : (s.weightLbs * s.reps > best.weightLbs * best.reps ? s : best)
    );

    const isAssisted = bestSet.exercise?.isAssisted ?? false;
    const isBodyweight = bestSet.exercise?.isBodyweight ?? false;
    const effectiveLoad = getEffectiveLoad(
      bestSet.weightLbs,
      bestSet.bodyweightLbs,
      bestSet.assistanceWeightLbs,
      isAssisted,
      isBodyweight,
      bestSet.exercise?.weightIsPerSide ?? false
    );

    const e1RM = Math.round(effectiveLoad * (1 + bestSet.reps / 30));

    return {
      lastWeight: bestSet.weightLbs,
      lastReps: bestSet.reps,
      lastRir: bestSet.rir,
      lastDate: lastSession[0].workout.date,
      lastExecutionOrder,
      positionChanged,
      currentExecutionOrder,
      e1RM,
      effectiveLoad,
      isAssisted,
      isBodyweight,
      allSets: lastSession.map((s) => ({
        weight: s.weightLbs,
        reps: s.reps,
        rir: s.rir,
        durationSeconds: s.durationSeconds ?? null,
        side: s.side,
        effectiveLoad: getEffectiveLoad(s.weightLbs, s.bodyweightLbs, s.assistanceWeightLbs, isAssisted, isBodyweight, bestSet.exercise?.weightIsPerSide ?? false),
      })),
    };
  } catch (error) {
    console.error('Failed to get exercise history:', error);
    return null;
  }
}

// Discard an in-progress workout entirely: deletes it (and its sets, via
// cascade) so it never counts as a completed workout. Refuses to delete a
// workout that's already been finished (durationMins > 0).
export async function cancelWorkout(workoutId: string) {
  try {
    const profile = await getProfile();
    if (!profile) return { success: false, error: 'Not authenticated' };

    const workout = await prisma.workout.findUnique({
      where: { id: workoutId },
      select: { profileId: true, durationMins: true },
    });
    if (!workout || workout.profileId !== profile.id) {
      return { success: false, error: 'Workout not found' };
    }
    if (workout.durationMins > 0) {
      return { success: false, error: 'Workout already completed' };
    }

    await prisma.workout.delete({ where: { id: workoutId } });
    return { success: true };
  } catch (error) {
    console.error('Failed to cancel workout:', error);
    return { success: false, error: 'Failed to cancel workout' };
  }
}

// Undo an accidental "Finish Workout" — clears the completion flag and summary
// so the workout page falls back to the live logging view. Restricted to
// workouts completed today; logged Sets are untouched either way.
export async function reopenWorkout(workoutId: string) {
  try {
    const profile = await getProfile();
    if (!profile) return { success: false, error: 'Not authenticated' };

    const workout = await prisma.workout.findUnique({
      where: { id: workoutId },
      select: { profileId: true, durationMins: true, date: true },
    });
    if (!workout || workout.profileId !== profile.id) {
      return { success: false, error: 'Workout not found' };
    }
    if (workout.durationMins === 0) {
      return { success: false, error: 'Workout is not completed' };
    }

    const { start, end } = getTodayBoundsUTC();
    if (workout.date < start || workout.date > end) {
      return { success: false, error: 'Can only reopen a workout completed today' };
    }

    await prisma.workout.update({
      where: { id: workoutId },
      data: { durationMins: 0, summaryJson: Prisma.JsonNull },
    });

    revalidatePath('/dashboard');
    revalidatePath('/calendar');
    revalidatePath('/history');
    return { success: true };
  } catch (error) {
    console.error('Failed to reopen workout:', error);
    return { success: false, error: 'Failed to reopen workout' };
  }
}

export async function finishWorkout(workoutId: string, durationMins: number, removedExerciseIds: string[] = []) {
  try {
    const profile = await getProfile();
    if (!profile) throw new Error('Not authenticated');

    const workout = await prisma.workout.findUnique({
      where: { id: workoutId },
      include: {
        sets: {
          include: {
            exercise: {
              select: {
                name: true,
                isUnilateral: true,
                isAssisted: true,
                isBodyweight: true,
                weightIsPerSide: true,
                isTimeBased: true,
              },
            },
          },
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

    const exerciseSummaries = [];

    // Build the list of exercises to summarize: every routine exercise, plus any
    // exercise that was logged but isn't in the routine (added mid-session via
    // "+ Exercise", or a non-routine superset partner). Without this, ad-hoc work
    // is silently dropped from the breakdown even though it counts toward totalSets.
    type SummaryTarget = {
      exerciseId: string;
      exercise: { name: string; isUnilateral: boolean; isAssisted: boolean; isBodyweight: boolean; weightIsPerSide: boolean; isTimeBased: boolean };
      planned: { targetSets: number; targetRepMin: number; targetRepMax: number; targetRir: number } | null;
      restTimerSecs: number;
    };

    // Exercises the user dropped from this session are excluded from the
    // breakdown (unless sets somehow remain for them). The routine itself is
    // untouched — they reappear next time the routine is run.
    const removed = new Set(removedExerciseIds);
    const exercisesToSummarize: SummaryTarget[] = (workout.routine?.exercises ?? [])
      .filter((re) => !(removed.has(re.exerciseId) && !workout.sets.some((s) => s.exerciseId === re.exerciseId)))
      .map((re) => ({
        exerciseId: re.exerciseId,
        exercise: re.exercise,
        planned: { targetSets: re.targetSets, targetRepMin: re.targetRepMin, targetRepMax: re.targetRepMax, targetRir: re.targetRir },
        restTimerSecs: re.restTimerSecs ?? 120,
      }));

    const seenExerciseIds = new Set(exercisesToSummarize.map((t) => t.exerciseId));
    for (const s of workout.sets) {
      if (seenExerciseIds.has(s.exerciseId)) continue;
      seenExerciseIds.add(s.exerciseId);
      exercisesToSummarize.push({
        exerciseId: s.exerciseId,
        exercise: s.exercise,
        planned: null,
        restTimerSecs: 120,
      });
    }

    for (const target of exercisesToSummarize) {
      const setsForExercise = workout.sets.filter(
        (s) => s.exerciseId === target.exerciseId
      );

      const planned = target.planned;
      const plannedSummary = planned
        ? { sets: planned.targetSets, repMin: planned.targetRepMin, repMax: planned.targetRepMax, rir: planned.targetRir }
        : null;

      const isUnilateral = target.exercise.isUnilateral;
      const isAssisted = target.exercise.isAssisted;
      const isBodyweight = target.exercise.isBodyweight;
      const weightIsPerSide = target.exercise.weightIsPerSide;
      const isTimeBased = target.exercise.isTimeBased;

      if (setsForExercise.length === 0) {
        exerciseSummaries.push({
          exerciseName: target.exercise.name,
          status: 'skipped' as const,
          planned: plannedSummary,
          sets: [],
          progressionFlag: null,
          progressionNote: '',
          asymmetryFlag: null,
        });
        continue;
      }

      // Time-based exercises don't have reps, so e1RM/volume progression is meaningless
      if (isTimeBased) {
        exerciseSummaries.push({
          exerciseName: target.exercise.name,
          status: 'completed' as const,
          isUnilateral,
          isAssisted,
          isBodyweight,
          planned: plannedSummary,
          sets: setsForExercise.map((s) => ({
            weight: s.weightLbs,
            reps: s.reps,
            rir: s.rir,
            durationSeconds: s.durationSeconds ?? null,
            setType: s.setType,
            side: s.side,
            effectiveLoad: s.weightLbs,
            assistanceWeight: null,
          })),
          progressionFlag: null,
          progressionNote: '',
          asymmetryFlag: null,
          avgRestSecs: null,
          restNote: null,
          currentE1RM: null,
          previousE1RM: null,
        });
        continue;
      }

      // ── Asymmetry check for unilateral exercises ──────────────────────
      let asymmetryFlag: null | { level: 'mild' | 'significant'; pct: number; weakSide: string } = null;

      if (isUnilateral) {
        const leftSets = setsForExercise.filter((s) => s.side === 'LEFT');
        const rightSets = setsForExercise.filter((s) => s.side === 'RIGHT');

        if (leftSets.length > 0 && rightSets.length > 0) {
          const leftVolume = leftSets.reduce((sum, s) => {
            const eff = getEffectiveLoad(s.weightLbs, s.bodyweightLbs, s.assistanceWeightLbs, isAssisted, isBodyweight, weightIsPerSide);
            return sum + eff * s.reps;
          }, 0);
          const rightVolume = rightSets.reduce((sum, s) => {
            const eff = getEffectiveLoad(s.weightLbs, s.bodyweightLbs, s.assistanceWeightLbs, isAssisted, isBodyweight, weightIsPerSide);
            return sum + eff * s.reps;
          }, 0);

          const maxVol = Math.max(leftVolume, rightVolume);
          const asymmetryPct = Math.round((Math.abs(leftVolume - rightVolume) / maxVol) * 100);
          const weakSide = leftVolume < rightVolume ? 'LEFT' : 'RIGHT';

          if (asymmetryPct >= 20) {
            asymmetryFlag = { level: 'significant', pct: asymmetryPct, weakSide };
          } else if (asymmetryPct >= 15) {
            asymmetryFlag = { level: 'mild', pct: asymmetryPct, weakSide };
          }
        }
      }

      // ── Progressive overload ──────────────────────────────────────────
      // Only compare against the same session type (Push vs Fullbody etc.)
      // Prevents cross-contamination: a fresh fullbody bench shouldn't be
      // compared against a fatigued Push-day bench, and vice versa.
      const previousSets = await prisma.set.findMany({
        where: {
          exerciseId: target.exerciseId,
          workout: {
            profileId: profile.id,
            focus: workout.focus,
          },
          isWarmup: false,
          NOT: { workoutId },
        },
        include: { workout: { select: { date: true } }, exercise: { select: { equipment: true, weightIsPerSide: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      const matchingSetType = setsForExercise[0]?.setType ?? 'STRAIGHT';
      const prevMatchingSets = previousSets.filter((s) => s.setType === matchingSetType);

      // Use effective load for e1RM calculation
      const calcE1RM = (s: { weightLbs: number; reps: number; bodyweightLbs: number | null; assistanceWeightLbs: number | null }) => {
        const eff = getEffectiveLoad(s.weightLbs, s.bodyweightLbs, s.assistanceWeightLbs, isAssisted, isBodyweight, weightIsPerSide);
        return Math.round(eff * (1 + s.reps / 30));
      };

      const prevBest = prevMatchingSets.length > 0
        ? prevMatchingSets.reduce((b, s) => calcE1RM(s) > calcE1RM(b) ? s : b)
        : null;

      const currBest = setsForExercise.reduce((b, s) => calcE1RM(s) > calcE1RM(b) ? s : b);

      const currE1RM = calcE1RM(currBest);
      const prevE1RM = prevBest ? calcE1RM(prevBest) : null;

      const positionChanged = prevBest
        ? Math.abs((prevBest.executionOrder ?? 0) - (currBest.executionOrder ?? 0)) >= 2
        : false;

      const currTotalVolume = setsForExercise.reduce((sum, s) => {
        const eff = getEffectiveLoad(s.weightLbs, s.bodyweightLbs, s.assistanceWeightLbs, isAssisted, isBodyweight, weightIsPerSide);
        return sum + eff * s.reps;
      }, 0);
      const prevTotalVolume = prevMatchingSets.reduce((sum, s) => {
        const eff = getEffectiveLoad(s.weightLbs, s.bodyweightLbs ?? null, s.assistanceWeightLbs ?? null, isAssisted, isBodyweight, weightIsPerSide);
        return sum + eff * s.reps;
      }, 0);

      const isGrouped = ['SUPERSET_A', 'SUPERSET_B', 'MYOREP_ACTIVATION', 'MYOREP_MINI', 'DROPSET_PRIMARY', 'DROPSET_DROP'].includes(matchingSetType);
      const isVolumeBased = ['MYOREP_MINI', 'DROPSET_DROP'].includes(matchingSetType);

      let progressionFlag: 'improved' | 'maintained' | 'declined' | 'context_change' | 'first_time' = 'first_time';
      let progressionNote = '';

      const contextTag = isGrouped ? ` (${matchingSetType.replace(/_/g, ' ').toLowerCase()})` : '';
      const loadLabel = isAssisted ? 'effective load' : 'e1RM';

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
          progressionNote = `${loadLabel}: ${prevE1RM}lbs → ${currE1RM}lbs (+${currE1RM - prevE1RM}lbs)${contextTag}.`;
        } else if (currE1RM === prevE1RM) {
          progressionFlag = 'maintained';
          progressionNote = `${loadLabel} held at ${currE1RM}lbs${contextTag}.`;
        } else {
          progressionFlag = 'declined';
          progressionNote = `${loadLabel}: ${prevE1RM}lbs → ${currE1RM}lbs (${currE1RM - prevE1RM}lbs)${contextTag}. Check position, rest, fatigue.`;
        }
      }

      // ── Rest time analysis ────────────────────────────────────────────────
        const sortedSets = [...setsForExercise].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        const restTimes: number[] = [];
        for (let i = 1; i < sortedSets.length; i++) {
          const restSecs = Math.round(
            (new Date(sortedSets[i].createdAt).getTime() -
              new Date(sortedSets[i - 1].createdAt).getTime()) / 1000
          );
          if (restSecs >= 15 && restSecs <= 600) {
            restTimes.push(restSecs);
          }
        }

        const avgRestSecs = restTimes.length > 0
          ? Math.round(restTimes.reduce((a, b) => a + b, 0) / restTimes.length)
          : null;

        // Flag if consistently under-resting on compounds
        const plannedRestSecs = target.restTimerSecs ?? 120;
        const underResting = avgRestSecs !== null && avgRestSecs < plannedRestSecs * 0.7;
        const overResting = avgRestSecs !== null && avgRestSecs > 300;

        let restNote: string | null = null;
        if (underResting) {
          restNote = `Avg rest: ${avgRestSecs}s (planned ${plannedRestSecs}s). Under-resting may explain lower reps.`;
        } else if (overResting) {
          restNote = `Avg rest: ${avgRestSecs}s — unusually long. Equipment wait or distraction?`;
        }

      exerciseSummaries.push({
        exerciseName: target.exercise.name,
        status: 'completed' as const,
        isUnilateral,
        isAssisted,
        isBodyweight,
        planned: plannedSummary,
        sets: setsForExercise.map((s) => ({
          weight: s.weightLbs,
          reps: s.reps,
          rir: s.rir,
          setType: s.setType,
          side: s.side,
          effectiveLoad: getEffectiveLoad(s.weightLbs, s.bodyweightLbs, s.assistanceWeightLbs, isAssisted, isBodyweight, weightIsPerSide),
          assistanceWeight: s.assistanceWeightLbs,
        })),
        progressionFlag,
        progressionNote,
        asymmetryFlag,
        avgRestSecs,
        restNote,
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

    await prisma.workout.update({
      where: { id: workoutId },
      data: {
        durationMins,
        summaryJson: {
          exerciseSummaries,
          deloadRecommended,
          totalSets: workout.sets.length,
          durationMins,
        },
      },
    });

    // Live updates: notify followers who subscribed to this routine. Best-effort
    // — never let a push failure break finishing the workout.
    try {
      if (workout.routineId) {
        const subs = await prisma.routineSubscription.findMany({
          where: { routineId: workout.routineId, notifyOnComplete: true },
          select: { subscriberId: true },
        });
        if (subs.length > 0) {
          const owner = await prisma.user.findUnique({
            where: { id: profile.userId },
            select: { username: true },
          });
          const routineName = workout.routine?.name ?? workout.focus;
          const { sendPushToProfile } = await import('../../lib/push');
          await Promise.all(
            subs.map((s) =>
              sendPushToProfile(s.subscriberId, {
                title: `@${owner?.username ?? 'A lifter'} finished ${routineName}`,
                body: 'See their latest numbers.',
              })
            )
          );
        }
      }
    } catch (notifyErr) {
      console.error('Subscriber notify failed:', notifyErr);
    }

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
    const all = await prisma.exercise.findMany({
      where: {
        primaryMuscle: primaryMuscle as any,
        NOT: { id: exerciseId },
      },
      select: {
        id: true,
        name: true,
        primaryMuscle: true,
        equipment: true,
        movementPattern: true,
        isUnilateral: true,
        isAssisted: true,
        isBodyweight: true,
        isTimeBased: true,
      },
      orderBy: { name: 'asc' },
    });

    // Sort: same movementPattern first (closest substitutes), then others
    const substitutes = [
      ...all.filter((e) => e.movementPattern === movementPattern),
      ...all.filter((e) => e.movementPattern !== movementPattern),
    ];

    return { success: true, substitutes };
  } catch (error) {
    console.error('Failed to fetch substitutes:', error);
    return { success: true, substitutes: [] };
  }
}