'use server';

import prisma from '../../lib/prisma';
import { hashPassword, verifyPassword, signToken } from '../../lib/auth';
import { cookies } from 'next/headers';

/**
 * Registers a new user, hashes their password, and sets a secure login cookie.
 */
export async function registerUser(formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password || password.length < 6) {
    return { error: 'Username and a password of at least 6 characters are required.' };
  }

  try {
    // 1. Check if the username is already taken
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return { error: 'Username is already taken.' };
    }

    // 2. Hash the password securely
    const passwordHash = await hashPassword(password);

    // 3. Create the user in the database
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
      },
    });

    // 4. Mint the secure session token
    const token = await signToken({ userId: user.id, username: user.username });
    
    // 5. Set the cookie in the user's browser
    const cookieStore = await cookies();
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return { success: true };
  } catch (error) {
    console.error('Registration error:', error);
    return { error: 'An unexpected error occurred while creating your account.' };
  }
}

/**
 * Verifies a user's credentials and logs them in by setting a secure cookie.
 */
export async function loginUser(formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { error: 'Username and password are required.' };
  }

  try {
    // 1. Find the user
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return { error: 'Invalid username or password.' };
    }

    // 2. Verify the password hash
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return { error: 'Invalid username or password.' };
    }

    // 3. Mint the token and set the cookie
    const token = await signToken({ userId: user.id, username: user.username });
    
    const cookieStore = await cookies();
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return { success: true };
  } catch (error) {
    console.error('Login error:', error);
    return { error: 'An unexpected error occurred while logging in.' };
  }
}

/**
 * Logs the user out by destroying their session cookie.
 */
export async function logoutUser() {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
}