import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import SettingsForm from './SettingsForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return redirect('/login');

  const decoded = await verifyToken(token);
  if (!decoded) return redirect('/login');

  const profile = await prisma.profile.findUnique({
    where: { userId: decoded.userId },
  });
  if (!profile) return redirect('/setup');

  const birthDate = new Date(profile.birthDate);
  const heightCm = profile.heightCm;
  const totalInches = Math.round(heightCm / 2.54);
  const heightFt = Math.floor(totalInches / 12);
  const heightIn = totalInches % 12;

  const latestMetric = await prisma.bodyMetric.findFirst({
    where: { profileId: profile.id },
    orderBy: { date: 'desc' },
  });
  const weightLbs = latestMetric
    ? Math.round(latestMetric.weightKg * 2.20462 * 10) / 10
    : 180;

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-12">
      <div className="mx-auto max-w-xl space-y-8">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Settings</h1>
            <p className="mt-1 text-zinc-400">Update your profile and training goals.</p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white"
          >
            ← Dashboard
          </Link>
        </header>
        <SettingsForm
          initialValues={{
            heightFt: String(heightFt),
            heightIn: String(heightIn),
            weightLbs: String(weightLbs),
            targetWeightLbs: profile.targetWeightLbs ? String(profile.targetWeightLbs) : '',
            birthMonth: String(birthDate.getMonth() + 1),
            birthYear: String(birthDate.getFullYear()),
            gender: profile.gender,
            goal: profile.currentGoal,
            weeklyGoalRate: String(profile.weeklyGoalRate),
            weekStartDay: String(profile.weekStartDay ?? 0),
          }}
        />
      </div>
    </main>
  );
}