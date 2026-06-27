'use server';

import prisma from '../../lib/prisma';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { getProfileFromCookie } from '../../lib/session';
import { isFollowing, canViewRoutine } from '../../lib/social';

// ── Follow graph ─────────────────────────────────────────────────────────────

export async function searchUsers(query: string) {
  const me = await getProfileFromCookie();
  if (!me) return [];
  const q = query.trim();
  if (q.length < 2) return [];

  const users = await prisma.user.findMany({
    where: {
      username: { contains: q, mode: 'insensitive' },
      profile: { isNot: null },
      NOT: { id: me.userId },
    },
    select: { username: true, profile: { select: { id: true } } },
    take: 10,
    orderBy: { username: 'asc' },
  });

  const myFollowing = await prisma.follow.findMany({
    where: { followerId: me.id, followingId: { in: users.map((u) => u.profile!.id) } },
    select: { followingId: true },
  });
  const followingSet = new Set(myFollowing.map((f) => f.followingId));

  return users.map((u) => ({
    username: u.username,
    profileId: u.profile!.id,
    isFollowing: followingSet.has(u.profile!.id),
  }));
}

export async function followUser(targetProfileId: string) {
  const me = await getProfileFromCookie();
  if (!me) return { success: false, error: 'Not authenticated' };
  if (me.id === targetProfileId) return { success: false, error: "Can't follow yourself" };

  const target = await prisma.profile.findUnique({ where: { id: targetProfileId }, select: { id: true } });
  if (!target) return { success: false, error: 'User not found' };

  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId: me.id, followingId: targetProfileId } },
    update: {},
    create: { followerId: me.id, followingId: targetProfileId },
  });
  revalidatePath('/following');
  return { success: true };
}

export async function unfollowUser(targetProfileId: string) {
  const me = await getProfileFromCookie();
  if (!me) return { success: false, error: 'Not authenticated' };

  await prisma.follow.deleteMany({
    where: { followerId: me.id, followingId: targetProfileId },
  });
  revalidatePath('/following');
  return { success: true };
}

// Public-facing profile by username: their shared routines + follow state.
export async function getUserPublicProfile(username: string) {
  const me = await getProfileFromCookie();
  const user = await prisma.user.findUnique({
    where: { username },
    select: { username: true, profile: { select: { id: true } } },
  });
  if (!user?.profile) return null;
  const ownerId = user.profile.id;
  const isMe = me?.id === ownerId;
  const following = me ? await isFollowing(me.id, ownerId) : false;

  const routines = await prisma.routine.findMany({
    where: {
      profileId: ownerId,
      isTrial: false,
      visibility: isMe ? undefined : { in: ['FOLLOWERS', 'LINK'] },
    },
    select: {
      id: true, name: true, focus: true, visibility: true,
      _count: { select: { exercises: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const [followerCount, followingCount] = await Promise.all([
    prisma.follow.count({ where: { followingId: ownerId } }),
    prisma.follow.count({ where: { followerId: ownerId } }),
  ]);

  return {
    username: user.username,
    profileId: ownerId,
    isMe,
    isFollowing: following,
    followerCount,
    followingCount,
    // Followers-only routines are openable only if you follow (or it's you).
    routines: routines.map((r) => ({
      id: r.id,
      name: r.name,
      focus: r.focus,
      visibility: r.visibility,
      exerciseCount: r._count.exercises,
      canOpen: isMe || following || r.visibility === 'LINK',
    })),
  };
}

// ── Sharing ──────────────────────────────────────────────────────────────────

export async function setRoutineVisibility(
  routineId: string,
  visibility: 'PRIVATE' | 'FOLLOWERS' | 'LINK'
) {
  const me = await getProfileFromCookie();
  if (!me) return { success: false, error: 'Not authenticated' };

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    select: { profileId: true, shareToken: true },
  });
  if (!routine || routine.profileId !== me.id) {
    return { success: false, error: 'Routine not found' };
  }

  // Mint a share token the first time a routine goes LINK; keep it thereafter.
  const shareToken =
    visibility === 'LINK' ? routine.shareToken ?? randomUUID().replace(/-/g, '') : routine.shareToken;

  await prisma.routine.update({
    where: { id: routineId },
    data: { visibility, shareToken },
  });
  revalidatePath('/routines');
  return { success: true, shareToken: visibility === 'LINK' ? shareToken : null };
}

// ── Clone / trial / save ─────────────────────────────────────────────────────

// Deep-copy a viewable routine's structure into the current user's routines.
// Numbers are never copied. asTrial marks it a flagged clone (test-drive).
export async function cloneRoutine(
  sourceRoutineId: string,
  opts?: { asTrial?: boolean; token?: string | null }
) {
  const me = await getProfileFromCookie();
  if (!me) return { success: false, error: 'Not authenticated' };

  const source = await prisma.routine.findUnique({
    where: { id: sourceRoutineId },
    select: {
      profileId: true, name: true, focus: true, notes: true, weeklyFrequency: true,
      visibility: true, shareToken: true,
      exercises: {
        orderBy: { order: 'asc' },
        select: {
          exerciseId: true, order: true, targetSets: true, targetRepMin: true,
          targetRepMax: true, targetRir: true, restTimerSecs: true, progressionStyle: true,
        },
      },
    },
  });
  if (!source) return { success: false, error: 'Routine not found' };

  const allowed = await canViewRoutine(me.id, source, opts?.token ?? undefined);
  if (!allowed) return { success: false, error: 'Not allowed' };

  const created = await prisma.routine.create({
    data: {
      profileId: me.id,
      name: source.name,
      focus: source.focus,
      notes: source.notes,
      weeklyFrequency: source.weeklyFrequency,
      visibility: 'PRIVATE',
      isTrial: opts?.asTrial ?? false,
      clonedFromRoutineId: sourceRoutineId,
      exercises: {
        create: source.exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          order: ex.order,
          targetSets: ex.targetSets,
          targetRepMin: ex.targetRepMin,
          targetRepMax: ex.targetRepMax,
          targetRir: ex.targetRir,
          restTimerSecs: ex.restTimerSecs,
          progressionStyle: ex.progressionStyle,
        })),
      },
    },
    select: { id: true },
  });

  revalidatePath('/routines');
  return { success: true, routineId: created.id };
}

// Promote a trial routine to a permanent one. Sets logged while trialing stay
// attached (same routine id) — only the trial flag changes.
export async function saveTrialAsRoutine(routineId: string) {
  const me = await getProfileFromCookie();
  if (!me) return { success: false, error: 'Not authenticated' };

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    select: { profileId: true, isTrial: true },
  });
  if (!routine || routine.profileId !== me.id) {
    return { success: false, error: 'Routine not found' };
  }
  if (!routine.isTrial) return { success: true }; // already a permanent routine

  await prisma.routine.update({ where: { id: routineId }, data: { isTrial: false } });
  revalidatePath('/routines');
  return { success: true };
}
