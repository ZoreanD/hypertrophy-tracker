'use client';
import { useRouter } from 'next/navigation';
import { logoutUser } from '../actions/auth';
import NavIcon from '../components/NavIcon';

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
      title="Log out"
      className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-semibold text-zinc-300 hover:border-red-800 hover:text-red-400"
    >
      <span className="nav-ico" aria-hidden><NavIcon name="logout" /></span><span className="nav-label">Log Out</span>
    </button>
  );
}