// app/workout/new/page.tsx
import prisma from '@/lib/prisma';
import WorkoutForm from './WorkoutForm';
import { redirect } from 'next/navigation';

export default async function NewWorkoutPage() {
  // Fetch the active profile
  const profile = await prisma.profile.findFirst();
  
  if (!profile) {
    redirect('/dashboard'); // Safety fallback
  }

  // Fetch all available exercises to populate the dropdown menu
  const exercises = await prisma.exercise.findMany({
    orderBy: { name: 'asc' },
  });

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="border-b border-zinc-800 pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-white">Log Training</h1>
          <p className="mt-1 text-zinc-400">Track your sets, reps, and proximity to failure.</p>
        </header>

        {/* Pass the server-fetched data into our Client Component */}
        <WorkoutForm profileId={profile.id} exercises={exercises} />
      </div>
    </main>
  );
}