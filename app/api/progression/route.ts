import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const exerciseId = searchParams.get('exerciseId');
  const profileId = searchParams.get('profileId');

  if (!exerciseId || !profileId) {
    return NextResponse.json({ data: [] });
  }

  const sets = await prisma.set.findMany({
    where: {
      exerciseId,
      workout: { profileId },
      isWarmup: false,
    },
    include: { workout: { select: { date: true } } },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  const byDate = new Map<string, typeof sets>();
  sets.forEach((s) => {
    const key = s.workout.date.toISOString().split('T')[0];
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(s);
  });

  const data = Array.from(byDate.entries()).map(([date, dateSets]) => {
    const best = dateSets.reduce((b, s) =>
      s.weightLbs * s.reps > b.weightLbs * b.reps ? s : b
    );
    return {
      date,
      e1RM: Math.round(best.weightLbs * (1 + best.reps / 30)),
      weight: best.weightLbs,
      reps: best.reps,
    };
  });

  return NextResponse.json({ data });
}