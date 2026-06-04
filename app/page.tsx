import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '../lib/auth';

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) return redirect('/login');

  const decoded = await verifyToken(token);
  if (!decoded) return redirect('/login');

  return redirect('/dashboard');
}