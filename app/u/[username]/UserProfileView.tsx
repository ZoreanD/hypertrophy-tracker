'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { followUser, unfollowUser } from '../../actions/social';

type Routine = {
  id: string;
  name: string;
  focus: string | null;
  visibility: 'PRIVATE' | 'FOLLOWERS' | 'LINK';
  exerciseCount: number;
  canOpen: boolean;
};

type Profile = {
  username: string;
  profileId: string;
  isMe: boolean;
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  routines: Routine[];
};

export default function UserProfileView({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [following, setFollowing] = useState(profile.isFollowing);
  const [pending, startTransition] = useTransition();

  function toggleFollow() {
    const next = !following;
    setFollowing(next); // optimistic
    startTransition(async () => {
      const res = next ? await followUser(profile.profileId) : await unfollowUser(profile.profileId);
      if (!res.success) { setFollowing(!next); alert(res.error || 'Failed'); return; }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">@{profile.username}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {profile.followerCount} follower{profile.followerCount === 1 ? '' : 's'} · {profile.followingCount} following
          </p>
        </div>
        {!profile.isMe && (
          <button
            onClick={toggleFollow}
            disabled={pending}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
              following
                ? 'border border-zinc-700 text-zinc-300 hover:border-zinc-500'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            {following ? 'Following' : 'Follow'}
          </button>
        )}
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {profile.isMe ? 'Your routines' : 'Shared routines'}
        </h2>
        {profile.routines.length === 0 && (
          <p className="text-sm text-zinc-500">No shared routines yet.</p>
        )}
        {profile.routines.map((r) => (
          <div key={r.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">{r.name}</p>
                <p className="text-xs text-zinc-500">
                  {r.focus ? `${r.focus} · ` : ''}{r.exerciseCount} exercise{r.exerciseCount === 1 ? '' : 's'}
                </p>
              </div>
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                {r.visibility === 'LINK' ? 'link' : r.visibility === 'FOLLOWERS' ? 'followers' : 'private'}
              </span>
            </div>

            {profile.isMe ? (
              <Link href={`/shared/${r.id}`} className="mt-3 inline-block text-xs text-emerald-400 hover:text-emerald-300">
                View →
              </Link>
            ) : r.canOpen ? (
              <Link
                href={`/shared/${r.id}`}
                className="mt-3 inline-block rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                View numbers &amp; trial →
              </Link>
            ) : (
              <p className="mt-3 text-xs text-yellow-500/80">Follow to access this routine.</p>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
