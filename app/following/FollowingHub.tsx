'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { searchUsers, followUser, unfollowUser } from '../actions/social';

type UserHit = { username: string; profileId: string; isFollowing: boolean };

export default function FollowingHub({
  following,
}: {
  following: { profileId: string; username: string }[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [followingList, setFollowingList] = useState(following);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function unfollow(profileId: string) {
    setFollowingList((prev) => prev.filter((u) => u.profileId !== profileId));
    const res = await unfollowUser(profileId);
    if (!res.success) { alert(res.error || 'Failed'); router.refresh(); return; }
    router.refresh();
  }

  function onChange(value: string) {
    setQuery(value);
    if (debounce.current) clearTimeout(debounce.current);
    if (value.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      const hits = await searchUsers(value);
      setResults(hits);
      setSearching(false);
    }, 300);
  }

  async function toggle(hit: UserHit) {
    const next = !hit.isFollowing;
    setResults((prev) => prev.map((h) => (h.profileId === hit.profileId ? { ...h, isFollowing: next } : h)));
    const res = next ? await followUser(hit.profileId) : await unfollowUser(hit.profileId);
    if (!res.success) {
      setResults((prev) => prev.map((h) => (h.profileId === hit.profileId ? { ...h, isFollowing: !next } : h)));
      alert(res.error || 'Failed');
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section>
        <input
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search lifters by username…"
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-3 text-sm text-white focus:border-emerald-500 focus:outline-none"
        />
        {query.trim().length >= 2 && (
          <div className="mt-2 divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800">
            {searching && <p className="p-3 text-center text-xs text-zinc-500">Searching…</p>}
            {!searching && results.length === 0 && (
              <p className="p-3 text-center text-xs text-zinc-500">No lifters found.</p>
            )}
            {results.map((hit) => (
              <div key={hit.profileId} className="flex items-center justify-between px-3 py-2.5 hover:bg-zinc-900/50">
                <Link href={`/u/${encodeURIComponent(hit.username)}`} className="text-sm font-medium text-white hover:text-emerald-400">
                  @{hit.username}
                </Link>
                <button
                  onClick={() => toggle(hit)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    hit.isFollowing
                      ? 'border border-zinc-700 text-zinc-300 hover:border-zinc-500'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  }`}
                >
                  {hit.isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">People you follow</h2>
        {followingList.length === 0 ? (
          <p className="text-sm text-zinc-500">You're not following anyone yet. Search above to get started.</p>
        ) : (
          <div className="divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800">
            {followingList.map((u) => (
              <div key={u.profileId} className="flex items-center justify-between px-3 py-3 hover:bg-zinc-900/50">
                <Link href={`/u/${encodeURIComponent(u.username)}`} className="text-sm font-medium text-white hover:text-emerald-400">
                  @{u.username}
                </Link>
                <button
                  onClick={() => unfollow(u.profileId)}
                  className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                >
                  Unfollow
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
