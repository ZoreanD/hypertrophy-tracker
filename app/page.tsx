import prisma from '../lib/prisma';
import { redirect } from 'next/navigation';

export default async function Home() {
  // 1. Check if a user profile exists in the database
  const profile = await prisma.profile.findFirst();

  // 2. Smart routing: send the user to the right place automatically
  if (!profile) {
    redirect('/setup');
  } else {
    redirect('/dashboard');
  }
}