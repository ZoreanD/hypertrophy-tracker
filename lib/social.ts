import prisma from './prisma';

// Minimal shape needed to decide access — pass a routine selected with these
// fields rather than re-fetching inside the helper.
export type RoutineAccess = {
  profileId: string; // owner
  visibility: 'PRIVATE' | 'FOLLOWERS' | 'LINK';
  shareToken: string | null;
};

// Is `followerId` following `followingId`? (Following yourself is implicitly true
// so self-access checks fall through cleanly.)
export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  if (followerId === followingId) return true;
  const edge = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
    select: { id: true },
  });
  return !!edge;
}

// Can this viewer open the routine at all (see its structure)?
//   own it | LINK + correct token | FOLLOWERS + follows owner. PRIVATE = no.
export async function canViewRoutine(
  viewerProfileId: string | null,
  routine: RoutineAccess,
  token?: string | null
): Promise<boolean> {
  if (viewerProfileId && viewerProfileId === routine.profileId) return true;
  if (routine.visibility === 'LINK') {
    return !!token && !!routine.shareToken && token === routine.shareToken;
  }
  if (routine.visibility === 'FOLLOWERS') {
    if (!viewerProfileId) return false;
    return isFollowing(viewerProfileId, routine.profileId);
  }
  return false; // PRIVATE
}

// Can this viewer see the OWNER's lift numbers? Only your own, or a routine that
// is shared (not private) belonging to someone you follow. Numbers surface only
// in the Following section — never on a viewer's trial/owned copies.
export async function canViewNumbers(
  viewerProfileId: string | null,
  routine: RoutineAccess
): Promise<boolean> {
  if (!viewerProfileId) return false;
  if (viewerProfileId === routine.profileId) return true;
  if (routine.visibility === 'PRIVATE') return false;
  return isFollowing(viewerProfileId, routine.profileId);
}
