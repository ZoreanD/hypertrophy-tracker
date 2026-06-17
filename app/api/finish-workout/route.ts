import { NextRequest, NextResponse } from 'next/server';
import { finishWorkout } from '../../actions/workout-session';

export async function POST(req: NextRequest) {
  try {
    const { workoutId, durationMins, removedExerciseIds } = await req.json();
    if (!workoutId || !durationMins) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
    }
    const result = await finishWorkout(workoutId, durationMins, removedExerciseIds);
    return NextResponse.json(result);
  } catch (error) {
    console.error('finish-workout API error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}