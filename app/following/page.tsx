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
      </div>
    </main>
  );
}
