import prisma from '../../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../../lib/auth';
import { redirect } from 'next/navigation';
import { todayInZone, resolveTimeZone } from '../../../lib/timezone';

export const dynamic = 'force-dynamic';

export default async function NewWorkoutPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return redirect('/login');

  const decoded = await verifyToken(token);
  if (!decoded) return redirect('/login');

  const profile = await prisma.profile.findUnique({ where: { userId: decoded.userId } });
  if (!profile) return redirect('/setup');

  const workout = await prisma.workout.create({
    data: {
      profileId: profile.id,
      routineId: null,
      focus: 'Ad-hoc Workout',
      durationMins: 0,
      // The lifter's local calendar day, anchored at UTC noon. The explicit Z
      // matters: without it the string parses in the SERVER's timezone, so the
      // stored instant (and therefore the day it reads back as) depends on where
      // the app happens to be deployed.
      date: new Date(todayInZone(resolveTimeZone(profile.timezone)) + 'T12:00:00Z'),
    },
  });

  redirect(`/workout/${workout.id}`);
}