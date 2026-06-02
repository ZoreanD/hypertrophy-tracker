import bcrypt from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';

// The number of hashing rounds. 10 is the industry standard balance of security and speed.
const SALT_ROUNDS = 10;

// We use TextEncoder to convert the secret into a byte array, which 'jose' requires.
// In production, you will want to add JWT_SECRET to your Vercel Environment Variables.
const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'super-secret-fallback-key-for-development-only'
);

/**
 * Scrambles a plain text password into a secure hash.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compares a login attempt password against the saved database hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Mints a secure, encrypted cookie token containing the user's ID.
 * Set to expire in 30 days so you and your friends don't have to constantly log in.
 */
export async function signToken(payload: { userId: string; username: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(SECRET_KEY);
}

/**
 * Decrypts and verifies the cookie token to confirm the user is logged in.
 */
export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as { userId: string; username: string };
  } catch (error) {
    // If the token is fake, expired, or tampered with, return null
    return null;
  }
}