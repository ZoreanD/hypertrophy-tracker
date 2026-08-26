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

  // Public ideas are visible to everyone (seeing what others asked for avoids
  // duplicates); private ones only ever come back for their author.
  const rows = await prisma.suggestion.findMany({
    where: {
      OR: [{ visibility: 'PUBLIC' }, { profileId: profile.id }],
    },
    orderBy: [{ createdAt: 'desc' }],
    take: 200,
    include: {
      profile: { include: { user: { select: { username: true } } } },
      votes: { select: { profileId: true, value: true } },
    },
  });

  const suggestions = rows.map((s) => ({
    id: s.id,
    body: s.body,
    status: s.status,
    visibility: s.visibility,
    createdAt: s.createdAt.toISOString(),
    username: s.profile.user.username,
    isMine: s.profileId === profile.id,
    score: s.votes.reduce((n, v) => n + v.value, 0),
    myVote: s.votes.find((v) => v.profileId === profile.id)?.value ?? 0,
  }));

  // Unresolved public ideas rank by demand so the loudest asks float up;
  // shipped/declined ones sink out of the way. Private stay chronological
  // alongside, since a vote count would be meaningless there.
  const isOpen = (st: string) => st === 'NEW' || st === 'PLANNED';
  suggestions.sort((a, b) => {
    if (isOpen(a.status) !== isOpen(b.status)) return isOpen(a.status) ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return b.createdAt.localeCompare(a.createdAt);
  });

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
