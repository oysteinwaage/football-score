import { increment, ref, remove, set, update } from 'firebase/database'
import { User } from 'firebase/auth'

import { database, firebaseConfigError } from '../firebase/config'
import { UserProfile, UserRole } from '../types/domain'

function requireDatabase() {
  if (!database) {
    throw new Error(firebaseConfigError ?? 'Firebase er ikke konfigurert.')
  }

  return database
}

export async function createUserProfile(user: User, parentName: string, childName: string, teamIds: string[] = []): Promise<UserProfile> {
  const now = new Date().toISOString()
  const profile: UserProfile = {
    id: user.uid,
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    parentName,
    childName,
    roles: [UserRole.FORELDER],
    teamIds,
    approved: false,
    ...(user.photoURL ? { photoUrl: user.photoURL } : {}),
    createdAt: now,
    updatedAt: now,
  }

  await set(ref(requireDatabase(), `users/${user.uid}`), profile)
  return profile
}

export async function saveUserPhotoUrl(userId: string, photoUrl: string): Promise<void> {
  await update(ref(requireDatabase(), `users/${userId}`), {
    photoUrl,
    updatedAt: new Date().toISOString(),
  })
}

export async function declineUserPhotoUrl(userId: string): Promise<void> {
  await update(ref(requireDatabase(), `users/${userId}`), {
    declinedPhotoUrl: true,
    updatedAt: new Date().toISOString(),
  })
}

export async function updateUserAccess(
  userId: string,
  updates: Pick<UserProfile, 'approved' | 'roles' | 'teamIds'>,
): Promise<void> {
  await update(ref(requireDatabase(), `users/${userId}`), {
    ...updates,
    updatedAt: new Date().toISOString(),
  })
}

export async function incrementUserSongPlay(userId: string, teamId: string): Promise<void> {
  await update(ref(requireDatabase(), `users/${userId}`), {
    [`songPlays/${teamId}`]: increment(1),
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteUserProfile(userId: string): Promise<void> {
  await remove(ref(requireDatabase(), `users/${userId}`))
}
