'use client';
import { useRouter } from 'next/navigation';
import { logoutUser } from '../actions/auth';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await logoutUser();
    router.push('/login');
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-semibold text-zinc-300 hover:border-red-800 hover:text-red-400"
    >
      Log Out
    </button>
  );
}