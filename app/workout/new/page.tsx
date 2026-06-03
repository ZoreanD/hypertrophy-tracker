import prisma from '@/lib/prisma';
import WorkoutForm from './WorkoutForm';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function NewWorkoutPage() {
  const profile = await prisma.profile.findFirst();
  if (!profile) {
    redirect('/dashboard');
  }

  const exercises = await prisma.exercise.findMany({
    orderBy: { name: 'asc' },
  });

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="border-b border-zinc-800 pb-6">
          <Link href="/dashboard" className="mb-3 inline-block text-sm text-zinc-500 hover:text-zinc-300">
            ← Dashboard
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-white">Log Training</h1>
          <p className="mt-1 text-zinc-400">Track your sets, reps, and proximity to failure.</p>
        </header>
        <WorkoutForm exercises={exercises} />
      </div>
    </main>
  );
}