'use server';

import prisma from '../../lib/prisma';
import { hashPassword, verifyPassword, signToken } from '../../lib/auth';
import { cookies } from 'next/headers';

export async function registerUser(formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password || password.length < 6) {
    return { error: 'Username and a password of at least 6 characters are required.' };
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { username } });
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
  } catch (error) {
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
    const user = await prisma.user.findUnique({ where: { username } });
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