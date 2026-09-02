import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getProfileFromCookie } from '../../../lib/session';
import { effectiveLoadOf, e1RMOf, bestSetBy1RM } from '../../../lib/effectiveLoad';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const exerciseId = searchParams.get('exerciseId');

  // The profile comes from the session, never the query string. It used to be
  // read straight off ?profileId=, which let anyone request anyone else's
  // training history.
  const profile = await getProfileFromCookie();
  if (!profile) return NextResponse.json({ data: [] }, { status: 401 });
  if (!exerciseId) return NextResponse.json({ data: [] });

  const [exercise, sets] = await Promise.all([
    prisma.exercise.findUnique({
      where: { id: exerciseId },
      select: { isAssisted: true, isBodyweight: true, weightIsPerSide: true },
    }),
    prisma.set.findMany({
      where: {
        exerciseId,
        workout: { profileId: profile.id },
        isWarmup: false,
      },
      include: { workout: { select: { date: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    }),
  ]);

  const shape = {
    isAssisted: exercise?.isAssisted ?? false,
    isBodyweight: exercise?.isBodyweight ?? false,
    weightIsPerSide: exercise?.weightIsPerSide ?? false,
  };

  const byDate = new Map<string, typeof sets>();
  sets.forEach((s) => {
    const key = s.workout.date.toISOString().split('T')[0];
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(s);
  });

  // Same ranking as every other consumer: estimated 1RM on EFFECTIVE load, with
  // fatigued fragments excluded. This route used to rank by weight x reps on the
  // raw selection, so changing the dropdown made the chart contradict the value
  // the page had just server-rendered.
  const data = Array.from(byDate.entries()).flatMap(([date, dateSets]) => {
    const best = bestSetBy1RM(dateSets, shape);
    if (!best) return [];
    const eff = effectiveLoadOf(best.weightLbs, shape, best.bodyweightLbs, best.assistanceWeightLbs);
    return [{
      date,
      e1RM: Math.round(e1RMOf(eff, best.reps)),
      weight: best.weightLbs,
      reps: best.reps,
    }];
  });

  return NextResponse.json({ data });
}
