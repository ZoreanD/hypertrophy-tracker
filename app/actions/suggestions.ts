'use server';

import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../lib/auth';
import { revalidatePath } from 'next/cache';

const MAX_BODY = 2000;

async function getProfile() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;
  const decoded = await verifyToken(token);
  if (!decoded) return null;
  return prisma.profile.findUnique({ where: { userId: decoded.userId } });
}

export async function submitSuggestion(body: string, visibility: 'PUBLIC' | 'PRIVATE' = 'PUBLIC') {
  try {
    const profile = await getProfile();
    if (!profile) return { success: false, error: 'Not signed in.' };

    const text = (body ?? '').trim();
    if (!text) return { success: false, error: 'Write something first.' };
    if (text.length > MAX_BODY) {
      return { success: false, error: `Keep it under ${MAX_BODY} characters.` };
    }

    await prisma.suggestion.create({
      data: {
        profileId: profile.id,
        body: text,
        visibility: visibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
      },
    });
    revalidatePath('/suggestions');
    return { success: true };
  } catch (error) {
    console.error('submitSuggestion failed:', error);
    return { success: false, error: 'Could not save that — try again.' };
  }
}

export async function deleteSuggestion(id: string) {
  try {
    const profile = await getProfile();
    if (!profile) return { success: false };
    // Scoped to the author, so one user can't delete another's suggestion.
    const result = await prisma.suggestion.deleteMany({
      where: { id, profileId: profile.id },
    });
    revalidatePath('/suggestions');
    return { success: result.count > 0 };
  } catch {
    return { success: false };
  }
}

/**
 * Cast, flip, or clear a vote. Only public suggestions are votable — a private
 * one is between its author and whoever triages it.
 *
 * Voting the same way twice clears the vote, so the button doubles as an undo.
 */
export async function voteSuggestion(suggestionId: string, value: 1 | -1) {
  try {
    const profile = await getProfile();
    if (!profile) return { success: false };

    const target = await prisma.suggestion.findUnique({
      where: { id: suggestionId },
      select: { visibility: true },
    });
    if (!target || target.visibility !== 'PUBLIC') return { success: false };

    const existing = await prisma.suggestionVote.findUnique({
      where: { suggestionId_profileId: { suggestionId, profileId: profile.id } },
    });

    if (existing?.value === value) {
      await prisma.suggestionVote.delete({ where: { id: existing.id } });
    } else if (existing) {
      await prisma.suggestionVote.update({ where: { id: existing.id }, data: { value } });
    } else {
      await prisma.suggestionVote.create({
        data: { suggestionId, profileId: profile.id, value },
      });
    }
    revalidatePath('/suggestions');
    return { success: true };
  } catch (error) {
    console.error('voteSuggestion failed:', error);
    return { success: false };
  }
}
