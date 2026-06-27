import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getProfileFromCookie } from '../../../lib/session';
import { getUserPublicProfile } from '../../actions/social';
import UserProfileView from './UserProfileView';

export const dynamic = 'force-dynamic';

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const me = await getProfileFromCookie();
  if (!me) return redirect('/login');

  const { username } = await params;
  const profile = await getUserPublicProfile(decodeURIComponent(username));

  if (!profile) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-12">
        <div className="mx-auto max-w-2xl">
          <Link href="/following" className="text-sm text-zinc-500 hover:text-zinc-300">← Following</Link>
          <p className="mt-8 text-center text-zinc-400">User not found.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link href="/following" className="text-sm text-zinc-500 hover:text-zinc-300">← Following</Link>
        <UserProfileView profile={profile} />
      </div>
    </main>
  );
}
