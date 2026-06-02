'use client';

import { useRouter } from 'next/navigation';
import { logoutUser } from '../actions/auth';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    // 1. Destroy the secure session cookie
    await logoutUser();
    
    // 2. Route back to the login screen
    router.push('/login');
    
    // 3. Force Next.js to re-evaluate the layout state
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-red-400 focus:outline-none focus:ring-1 focus:ring-red-500"
    >
      Log Out
    </button>
  );
}