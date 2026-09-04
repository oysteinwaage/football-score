import { push, ref, set, update } from 'firebase/database'

import { database, firebaseConfigError } from '../firebase/config'
import { PlayerRecord } from '../types/domain'

function requireDatabase() {
  if (!database) {
    throw new Error(firebaseConfigError ?? 'Firebase er ikke konfigurert.')
  }

  return database
}

export async function createPlayer(name: string): Promise<PlayerRecord> {
  const db = requireDatabase()
  const playerRef = push(ref(db, 'players'))
  const id = playerRef.key

  if (!id) {
    throw new Error('Kunne ikke opprette spiller-ID.')
  }

  const now = new Date().toISOString()
  const player: PlayerRecord = {
    id,
    name,
    parentIds: [],
    createdAt: now,
    updatedAt: now,
  }

  await set(playerRef, player)
  return player
}

export async function deletePlayer(playerId: string, parentIds: string[] = []): Promise<void> {
  const updates: Record<string, unknown> = {
    [`players/${playerId}`]: null,
  }

  parentIds.forEach((userId) => {
    updates[`users/${userId}/childPlayerIds/${playerId}`] = null
  })

  await update(ref(requireDatabase()), updates)
}

export async function updatePlayerParents(
  playerId: string,
  parentIds: string[],
  previousParentIds: string[] = [],
): Promise<void> {
  const added = parentIds.filter((id) => !previousParentIds.includes(id))
  const removed = previousParentIds.filter((id) => !parentIds.includes(id))

  const updates: Record<string, unknown> = {
    [`players/${playerId}/parentIds`]: parentIds,
    [`players/${playerId}/updatedAt`]: new Date().toISOString(),
  }

  added.forEach((userId) => {
    updates[`users/${userId}/childPlayerIds/${playerId}`] = true
  })
  removed.forEach((userId) => {
    updates[`users/${userId}/childPlayerIds/${playerId}`] = null
  })

  await update(ref(requireDatabase()), updates)
}
