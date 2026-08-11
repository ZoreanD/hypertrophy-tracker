// Year in Review ("Wrapped") — pure aggregation over a year of logged training.
//
// Everything here is deterministic and side-effect free: the page fetches rows,
// hands them in, and gets back the finished story. Keeping it pure means the
// numbers can be unit-checked and reused (share card, past years) without
// touching the database again.
//
// A workout's `date` is a CALENDAR DAY, not an instant — it records "I trained
// on Dec 31", and it's written as noon on that day so no timezone conversion can
// push it off. So bucketing reads the day straight off the stored value instead
// of re-interpreting it in a timezone: doing the latter shifts every workout a
// day forward for zones far enough east, and across Dec 31 it shifts the YEAR,
// dropping sessions out of their own Wrapped.
//
// (Choosing WHICH year's Wrapped is currently live is a different question — that
// genuinely depends on the lifter's clock, and activeWrappedYear takes it.)

import { groupOf, setCountWeight, VOLUME_LANDMARKS, INDIRECT_FRACTION } from './volume';

/** The calendar day a stored workout date represents, as YYYY-MM-DD. */
export function workoutDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type WrappedSet = {
  weightLbs: number;
  reps: number;
  side: string | null;
  isWarmup: boolean;
  durationSeconds: number | null;
  assistanceWeightLbs: number | null;
  bodyweightLbs: number | null;
  exercise: {
    id: string;
    name: string;
    primaryMuscle: string;
    secondaryMuscles: string[];
    isAssisted: boolean;
    isBodyweight: boolean;
    weightIsPerSide: boolean;
    isTimeBased: boolean;
  };
};

export type WrappedWorkout = {
  id: string;
  date: Date;
  focus: string;
  durationMins: number;
  sets: WrappedSet[];
};

// Mirrors getEffectiveLoad in app/actions/workout-session.ts — what the muscle
// actually worked against, not what was written on the pin.
export function effectiveLoad(s: WrappedSet): number {
  const ex = s.exercise;
  if (ex.isAssisted && s.bodyweightLbs && s.assistanceWeightLbs) {
    return Math.max(0, s.bodyweightLbs - s.assistanceWeightLbs);
  }
  if (ex.isBodyweight && s.bodyweightLbs) return s.bodyweightLbs + s.weightLbs;
  if (ex.weightIsPerSide) return s.weightLbs * 2;
  return s.weightLbs;
}

// Epley, matching the app's existing e1RM elsewhere.
export function e1RM(s: WrappedSet): number {
  if (s.reps <= 0) return 0;
  return effectiveLoad(s) * (1 + s.reps / 30);
}

// Weekday/month are read from the calendar day itself (anchored at UTC noon) so
// they can't drift with the viewer's timezone either.
export function weekdayOf(day: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' })
    .format(new Date(day + 'T12:00:00Z'));
}

export function monthOf(day: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long' })
    .format(new Date(day + 'T12:00:00Z'));
}

export type ExerciseProgress = {
  exerciseId: string;
  name: string;
  firstE1RM: number;
  bestE1RM: number;
  gainLbs: number;
  gainPct: number;
  sessions: number;
};

export type WrappedData = {
  year: number;
  hasData: boolean;
  // Core
  totalWorkouts: number;
  totalWorkingSets: number;
  totalReps: number;
  totalTonnageLbs: number;
  totalMinutes: number;
  activeDays: number;
  longestStreakDays: number;
  topMuscleGroup: { key: string; label: string; sets: number } | null;
  muscleBreakdown: { key: string; label: string; sets: number }[];
  topExercises: { exerciseId: string; name: string; sets: number }[];
  // Strength story
  progression: ExerciseProgress[];
  biggestGain: ExerciseProgress | null;
  // Personality
  busiestWeekday: { day: string; count: number } | null;
  mainCharacterLift: { name: string; tonnageLbs: number } | null;
  busiestMonth: { month: string; count: number } | null;
  title: string;
  titleBlurb: string;
};

// Consecutive-calendar-day streak over the set of days trained.
function longestStreak(days: string[]): number {
  if (days.length === 0) return 0;
  const sorted = Array.from(new Set(days)).sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T12:00:00Z').getTime();
    const cur = new Date(sorted[i] + 'T12:00:00Z').getTime();
    const gapDays = Math.round((cur - prev) / 86400000);
    run = gapDays === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

// A playful title from the lifter's actual distribution. Ordered most specific
// first so a genuinely lopsided year gets a pointed title rather than a generic
// one.
function deriveTitle(
  groupSets: Record<string, number>,
  totalWorkouts: number,
  streak: number,
): { title: string; blurb: string } {
  const g = (k: string) => groupSets[k] ?? 0;
  const push = g('CHEST_UPPER') + g('CHEST_MID_LOWER') + g('TRICEPS') + g('FRONT_DELT');
  const pull = g('LATS') + g('UPPER_BACK') + g('BICEPS');
  const legs = g('QUADS') + g('HAMSTRINGS') + g('GLUTES') + g('CALVES');
  const total = push + pull + legs;

  if (total === 0) return { title: 'The Beginning', blurb: 'Every arc starts somewhere.' };
  if (streak >= 7) {
    return { title: 'The Relentless', blurb: `${streak} days in a row. Rest is a suggestion, apparently.` };
  }
  if (legs / total >= 0.4) {
    return { title: 'Leg Day Devotee', blurb: 'You never skipped it. Genuinely rare.' };
  }
  if (pull / total >= 0.42) {
    return { title: 'Back Specialist', blurb: 'Rows, pulls, and more rows. The mirror muscles can wait.' };
  }
  if (push / total >= 0.45) {
    return { title: 'Press Enthusiast', blurb: 'If it moves away from your chest, you trained it.' };
  }
  if (totalWorkouts >= 100) {
    return { title: 'The Machine', blurb: `${totalWorkouts} sessions. That is a full-time hobby.` };
  }
  return { title: 'The Balanced', blurb: 'Push, pull, legs — you actually rotated properly.' };
}

export function buildWrapped(
  workouts: WrappedWorkout[],
  year: number,
): WrappedData {
  // Only completed sessions whose calendar day falls in the target year.
  const inYear = workouts.filter(
    (w) => w.durationMins > 0 && workoutDay(w.date).slice(0, 4) === String(year),
  );

  const empty: WrappedData = {
    year, hasData: false,
    totalWorkouts: 0, totalWorkingSets: 0, totalReps: 0, totalTonnageLbs: 0,
    totalMinutes: 0, activeDays: 0, longestStreakDays: 0,
    topMuscleGroup: null, muscleBreakdown: [], topExercises: [],
    progression: [], biggestGain: null,
    busiestWeekday: null, mainCharacterLift: null, busiestMonth: null,
    title: 'No Data Yet', titleBlurb: 'Log some training and come back.',
  };
  if (inYear.length === 0) return empty;

  let totalWorkingSets = 0;
  let totalReps = 0;
  let totalTonnage = 0;
  let totalMinutes = 0;
  const groupSets: Record<string, number> = {};
  const exerciseSets: Record<string, { name: string; sets: number; tonnage: number }> = {};
  const weekdayCount: Record<string, number> = {};
  const monthCount: Record<string, number> = {};
  const days: string[] = [];
  // exerciseId -> chronological best-e1RM per session, for the strength story
  const sessionBests: Record<string, { name: string; entries: { day: string; e1rm: number }[] }> = {};

  for (const w of inYear) {
    totalMinutes += w.durationMins;
    const day = workoutDay(w.date);
    days.push(day);
    const wd = weekdayOf(day);
    weekdayCount[wd] = (weekdayCount[wd] ?? 0) + 1;
    const month = monthOf(day);
    monthCount[month] = (monthCount[month] ?? 0) + 1;

    const bestThisSession: Record<string, number> = {};

    for (const s of w.sets) {
      if (s.isWarmup) continue;
      const weight = setCountWeight(s.side);
      totalWorkingSets += weight;
      totalReps += s.reps;
      totalTonnage += effectiveLoad(s) * s.reps;

      // Volume by muscle group, same model as the dashboard.
      const primary = groupOf(s.exercise.primaryMuscle);
      groupSets[primary] = (groupSets[primary] ?? 0) + weight;
      const credited = new Set<string>([primary]);
      for (const sec of s.exercise.secondaryMuscles ?? []) {
        const gg = groupOf(sec);
        if (credited.has(gg)) continue;
        credited.add(gg);
        groupSets[gg] = (groupSets[gg] ?? 0) + weight * INDIRECT_FRACTION;
      }

      const ex = s.exercise;
      if (!exerciseSets[ex.id]) exerciseSets[ex.id] = { name: ex.name, sets: 0, tonnage: 0 };
      exerciseSets[ex.id].sets += weight;
      exerciseSets[ex.id].tonnage += effectiveLoad(s) * s.reps;

      // Time-based work has reps=0, so e1RM is meaningless — skip it.
      if (!ex.isTimeBased && s.reps > 0) {
        const est = e1RM(s);
        if (est > (bestThisSession[ex.id] ?? 0)) bestThisSession[ex.id] = est;
        if (!sessionBests[ex.id]) sessionBests[ex.id] = { name: ex.name, entries: [] };
      }
    }

    for (const [exId, best] of Object.entries(bestThisSession)) {
      sessionBests[exId]?.entries.push({ day, e1rm: best });
    }
  }

  const muscleBreakdown = Object.entries(groupSets)
    .filter(([k]) => VOLUME_LANDMARKS[k])
    .map(([k, sets]) => ({ key: k, label: VOLUME_LANDMARKS[k].label, sets: Math.round(sets * 10) / 10 }))
    .sort((a, b) => b.sets - a.sets);

  const topExercises = Object.entries(exerciseSets)
    .map(([id, v]) => ({ exerciseId: id, name: v.name, sets: Math.round(v.sets * 10) / 10 }))
    .sort((a, b) => b.sets - a.sets)
    .slice(0, 5);

  // Strength story: needs at least two separate sessions to show movement.
  //
  // The baseline is the MEDIAN of the first up-to-3 sessions, not the single
  // first one. Real logs contain fat-finger entries (a 5lb/1rep "set" that was
  // really a machine setup), and using the raw first session lets one bad row
  // headline the whole year with something like "+2884%". A median over the
  // opening sessions ignores a lone outlier while still reflecting where the
  // lift actually started.
  const progression: ExerciseProgress[] = Object.entries(sessionBests)
    .map(([exId, v]) => {
      const entries = v.entries.slice().sort((a, b) => a.day.localeCompare(b.day));
      if (entries.length < 2) return null;
      // With only two sessions there's nothing to smooth — a median would pick
      // the LARGER of the pair and report a flat 0 gain, hiding real progress.
      // Median smoothing only kicks in once there are 3+ points.
      const first = entries.length >= 3
        ? entries.slice(0, 3).map((e) => e.e1rm).sort((a, b) => a - b)[1]
        : entries[0].e1rm;
      const best = Math.max(...entries.map((e) => e.e1rm));
      // Round the endpoints first, then derive the gain from them, so the
      // displayed "+N lbs" always equals the displayed "X → Y".
      const firstR = Math.round(first);
      const bestR = Math.round(best);
      return {
        exerciseId: exId,
        name: v.name,
        firstE1RM: firstR,
        bestE1RM: bestR,
        gainLbs: bestR - firstR,
        gainPct: firstR > 0 ? Math.round(((bestR - firstR) / firstR) * 100) : 0,
        sessions: entries.length,
      };
    })
    .filter((x): x is ExerciseProgress => x !== null)
    .sort((a, b) => b.gainLbs - a.gainLbs);

  const busiestWeekdayEntry = Object.entries(weekdayCount).sort((a, b) => b[1] - a[1])[0];
  const busiestMonthEntry = Object.entries(monthCount).sort((a, b) => b[1] - a[1])[0];
  const mainCharacter = Object.values(exerciseSets).sort((a, b) => b.tonnage - a.tonnage)[0];
  const streak = longestStreak(days);
  const { title, blurb: titleBlurb } = deriveTitle(groupSets, inYear.length, streak);

  return {
    year,
    hasData: true,
    totalWorkouts: inYear.length,
    totalWorkingSets: Math.round(totalWorkingSets * 10) / 10,
    totalReps,
    totalTonnageLbs: Math.round(totalTonnage),
    totalMinutes,
    activeDays: new Set(days).size,
    longestStreakDays: streak,
    topMuscleGroup: muscleBreakdown[0] ?? null,
    muscleBreakdown: muscleBreakdown.slice(0, 6),
    topExercises,
    progression: progression.slice(0, 5),
    // Headline gain: still guard against a baseline that survived smoothing but
    // is clearly not a real starting point (a >300% "gain" is a logging story,
    // not a training story). Fall back to the best plausible one.
    biggestGain: progression.find((p) => p.gainLbs > 0 && p.gainPct <= 300)
      ?? progression.find((p) => p.gainLbs > 0)
      ?? null,
    busiestWeekday: busiestWeekdayEntry
      ? { day: busiestWeekdayEntry[0], count: busiestWeekdayEntry[1] } : null,
    mainCharacterLift: mainCharacter
      ? { name: mainCharacter.name, tonnageLbs: Math.round(mainCharacter.tonnage) } : null,
    busiestMonth: busiestMonthEntry
      ? { month: busiestMonthEntry[0], count: busiestMonthEntry[1] } : null,
    title,
    titleBlurb,
  };
}

// ── Availability window ────────────────────────────────────────────────────
// Wrapped is a moment, not a permanent page: it opens late in the year and
// closes a couple of weeks into the next one. Saving the share card is how it
// outlives the window.
export const WRAPPED_OPEN_MONTH = 12; // December
export const WRAPPED_OPEN_DAY = 20;
export const WRAPPED_CLOSE_MONTH = 1; // through mid-January
export const WRAPPED_CLOSE_DAY = 7;

// Which year's Wrapped (if any) is live on `today` (a YYYY-MM-DD in the
// lifter's zone). Dec 20–31 → this year; Jan 1–7 → last year; else null.
export function activeWrappedYear(today: string): number | null {
  const [y, m, d] = today.split('-').map(Number);
  if (m === WRAPPED_OPEN_MONTH && d >= WRAPPED_OPEN_DAY) return y;
  if (m === WRAPPED_CLOSE_MONTH && d <= WRAPPED_CLOSE_DAY) return y - 1;
  return null;
}
