import { push, ref, set, update } from 'firebase/database'

import { database, firebaseConfigError } from '../firebase/config'
import { CoachRecord, UserProfile } from '../types/domain'

function requireDatabase() {
  if (!database) {
    throw new Error(firebaseConfigError ?? 'Firebase er ikke konfigurert.')
  }

  return database
}

export async function createCoach(name: string): Promise<CoachRecord> {
  const db = requireDatabase()
  const coachRef = push(ref(db, 'coaches'))
  const id = coachRef.key

  if (!id) {
    throw new Error('Kunne ikke opprette trener-ID.')
  }

  const now = new Date().toISOString()
  const coach: CoachRecord = {
    id,
    name,
    createdAt: now,
    updatedAt: now,
  }

  await set(coachRef, coach)
  return coach
}

export async function deleteCoach(coach: CoachRecord): Promise<void> {
  const updates: Record<string, unknown> = {
    [`coaches/${coach.id}`]: null,
  }

  if (coach.userId) {
    updates[`users/${coach.userId}/coachId`] = null
  }

  await update(ref(requireDatabase()), updates)
}

/**
 * Kobler treneren til én brukerprofil (eller fjerner koblingen med `userId = null`).
 * En bruker kan bare være koblet til én trener, så en eventuell tidligere kobling på brukeren fjernes.
 */
export async function updateCoachUser(
  coach: CoachRecord,
  userId: string | null,
  coaches: CoachRecord[],
  users: UserProfile[],
): Promise<void> {
  const now = new Date().toISOString()
  const updates: Record<string, unknown> = {
    [`coaches/${coach.id}/userId`]: userId,
    [`coaches/${coach.id}/updatedAt`]: now,
  }

  if (coach.userId && coach.userId !== userId) {
    updates[`users/${coach.userId}/coachId`] = null
  }

  if (userId) {
    const previousCoachId = users.find((u) => u.id === userId)?.coachId
    if (previousCoachId && previousCoachId !== coach.id && coaches.some((c) => c.id === previousCoachId)) {
      updates[`coaches/${previousCoachId}/userId`] = null
      updates[`coaches/${previousCoachId}/updatedAt`] = now
    }
    updates[`users/${userId}/coachId`] = coach.id
  }

  await update(ref(requireDatabase()), updates)
}
