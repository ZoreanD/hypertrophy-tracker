import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import SuggestionBox from './SuggestionBox';

export const dynamic = 'force-dynamic';

export default async function SuggestionsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return redirect('/login');

  const decoded = await verifyToken(token);
  if (!decoded) return redirect('/login');

  const profile = await prisma.profile.findUnique({
    where: { userId: decoded.userId },
  });
  if (!profile) return redirect('/setup');

  // Everyone's suggestions are visible — seeing what others asked for avoids
  // duplicates and shows what's already been picked up.
  const rows = await prisma.suggestion.findMany({
    orderBy: [{ createdAt: 'desc' }],
    take: 100,
    include: { profile: { include: { user: { select: { username: true } } } } },
  });

  const suggestions = rows.map((s) => ({
    id: s.id,
    body: s.body,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    username: s.profile.user.username,
    isMine: s.profileId === profile.id,
  }));

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Suggestions</h1>
            <p className="mt-1 text-zinc-400">
              Ideas, gripes, missing exercises — leave it here.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white"
          >
            ← Dashboard
          </Link>
        </header>

        <SuggestionBox suggestions={suggestions} />
      </div>
    </main>
  );
}
