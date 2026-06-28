'use server';

import prisma from '../../lib/prisma';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../../lib/auth';
import { cookies } from 'next/headers';

export async function registerUser(formData: FormData) {
  const username = ((formData.get('username') as string) ?? '').trim();
  const password = formData.get('password') as string;

  if (!username || !password || password.length < 6) {
    return { error: 'Username and a password of at least 6 characters are required.' };
  }
  if (username.length < 3 || username.length > 20) {
    return { error: 'Username must be 3–20 characters.' };
  }

  try {
    // Case-insensitive uniqueness so "Zorean" and "zorean" can't both exist.
    const existingUser = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
    });
    if (existingUser) {
      return { error: 'Username is already taken.' };
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { username, passwordHash },
    });

    const token = await signToken({ userId: user.id, username: user.username });
    const cookieStore = await cookies();
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    // Brand new users always go to setup
    return { success: true, redirectTo: '/setup' };
  } catch (error: any) {
    // Unique-constraint violation (e.g. a race between the check and create).
    if (error?.code === 'P2002') {
      return { error: 'Username is already taken.' };
    }
    console.error('Registration error:', error);
    return { error: 'An unexpected error occurred while creating your account.' };
  }
}

export async function loginUser(formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { error: 'Username and password are required.' };
  }

  try {
    // Case-insensitive so login matches regardless of how they typed their name.
    const user = await prisma.user.findFirst({
      where: { username: { equals: username.trim(), mode: 'insensitive' } },
    });
    if (!user) return { error: 'Invalid username or password.' };

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) return { error: 'Invalid username or password.' };

    const token = await signToken({ userId: user.id, username: user.username });
    const cookieStore = await cookies();
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    // CHECK FOR PROFILE: If they have one, send them to dashboard. If not, setup.
    const profile = await prisma.profile.findUnique({ where: { userId: user.id } });

    return { success: true, redirectTo: profile ? '/dashboard' : '/setup' };
  } catch (error) {
    console.error('Login error:', error);
    return { error: 'An unexpected error occurred while logging in.' };
  }
}

export async function logoutUser() {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
}
export async function changePassword(formData: FormData) {
  const currentPassword = formData.get('currentPassword') as string;
  const newPassword = formData.get('newPassword') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!currentPassword || !newPassword || !confirmPassword)
    return { error: 'All fields are required.' };
  if (newPassword.length < 6)
    return { error: 'New password must be at least 6 characters.' };
  if (newPassword !== confirmPassword)
    return { error: 'New passwords do not match.' };

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return { error: 'Not authenticated.' };

  const session = await verifyToken(token);
  if (!session) return { error: 'Invalid session.' };

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return { error: 'User not found.' };

  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValid) return { error: 'Current password is incorrect.' };

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash: newHash },
  });

  return { success: true };
}