import { redirect } from 'next/navigation';
import Link from 'next/link';
import prisma from '../../lib/prisma';
import { getProfileFromCookie } from '../../lib/session';
import FollowingHub from './FollowingHub';

export const dynamic = 'force-dynamic';

export default async function FollowingPage() {
  const me = await getProfileFromCookie();
  if (!me) return redirect('/login');

  const edges = await prisma.follow.findMany({
    where: { followerId: me.id },
    select: { following: { select: { id: true, user: { select: { username: true } } } } },
    orderBy: { createdAt: 'desc' },
  });

  const following = edges.map((e) => ({
    profileId: e.following.id,
    username: e.following.user.username,
  }));

  // Activity feed: recent completed sessions by people you follow, on their
  // shared routines.
  const followingIds = following.map((f) => f.profileId);
  const feed = followingIds.length
    ? await prisma.workout.findMany({
        where: {
          profileId: { in: followingIds },
          durationMins: { gt: 0 },
          routineId: { not: null },
          routine: { is: { visibility: { not: 'PRIVATE' }, isTrial: false } },
        },
        orderBy: { date: 'desc' },
        take: 15,
        select: {
          id: true, date: true, routineId: true,
          routine: { select: { name: true } },
          profile: { select: { user: { select: { username: true } } } },
        },
      })
    : [];

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-white">Following</h1>
            <p className="mt-1 text-sm text-zinc-500">Find lifters and trial their routines.</p>
          </div>
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-300">Dashboard</Link>
        </header>
        <FollowingHub following={following} />

        {feed.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Recent activity</h2>
            <div className="divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800">
              {feed.map((w) => (
                <Link
                  key={w.id}
                  href={`/shared/${w.routineId}`}
                  className="flex items-center justify-between px-3 py-3 hover:bg-zinc-900/50"
                >
                  <span className="text-sm text-zinc-200">
                    <span className="font-medium text-white">@{w.profile.user.username}</span> finished{' '}
                    <span className="text-emerald-400">{w.routine?.name}</span>
                  </span>
                  <span className="text-xs text-zinc-500">
                    {new Date(w.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
