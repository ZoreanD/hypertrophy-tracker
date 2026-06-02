// app/setup/page.tsx
import prisma from '../../lib/prisma';
import { redirect } from 'next/navigation';
import SetupForm from './SetupForm';

export default async function SetupPage() {
  const profile = await prisma.profile.findFirst();
  if (profile) redirect('/dashboard');

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-12">
      <div className="mx-auto max-w-xl space-y-8">
        <header className="border-b border-zinc-800 pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-white">Profile Setup</h1>
          <p className="mt-1 text-zinc-400">This is used to calculate your daily targets accurately.</p>
        </header>
        <SetupForm />
      </div>
    </main>
  );
}