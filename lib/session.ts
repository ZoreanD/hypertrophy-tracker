import { cookies } from 'next/headers';
import { verifyToken } from './auth';
import prisma from './prisma';

// Resolve the logged-in profile from the auth cookie, for use in route handlers.
export async function getProfileFromCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;
  const decoded = await verifyToken(token);
  if (!decoded) return null;
  return prisma.profile.findUnique({ where: { userId: decoded.userId } });
}
