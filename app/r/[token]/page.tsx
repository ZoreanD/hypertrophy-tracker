import { redirect } from 'next/navigation';
import prisma from '../../../lib/prisma';

export const dynamic = 'force-dynamic';

// Share-link entry point. Resolves the token to a routine and hands off to the
// shared view (which enforces access — LINK + token grants structure; numbers
// still require following the owner).
export default async function ShareLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const routine = await prisma.routine.findUnique({
    where: { shareToken: token },
    select: { id: true },
  });
  if (!routine) return redirect('/following');
  return redirect(`/shared/${routine.id}?t=${encodeURIComponent(token)}`);
}
