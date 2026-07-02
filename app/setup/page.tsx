// app/setup/page.tsx
import prisma from '../../lib/prisma';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '../../lib/auth';
import SetupForm from './SetupForm';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return redirect('/login');

  const decoded = await verifyToken(token);
  if (!decoded) return redirect('/login');

  // Only redirect if THIS user already has a profile — not just any profile in
  // the table. findFirst() returned another user's profile, causing a
  // /setup <-> /dashboard redirect loop for brand-new users.
  const profile = await prisma.profile.findUnique({ where: { userId: decoded.userId } });
  if (profile) return redirect('/dashboard');

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
