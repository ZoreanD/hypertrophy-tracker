import prisma from '../../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../../lib/auth';
import { redirect } from 'next/navigation';

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
      date: new Date(
        new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10) + 'T12:00:00'
      ),
    },
  });

  redirect(`/workout/${workout.id}`);
}