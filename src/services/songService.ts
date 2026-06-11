import { get, increment, push, ref, remove, set, update } from 'firebase/database'

import { database, firebaseConfigError } from '../firebase/config'
import { SongRecord, TeamRecord, UserProfile } from '../types/domain'

function requireDatabase() {
  if (!database) {
    throw new Error(firebaseConfigError ?? 'Firebase er ikke konfigurert.')
  }
  return database
}

function normalizeSongUrl(url: string): string {
  const sunoMatch = url.match(/suno\.com\/song\/([a-f0-9-]+)/)
  if (sunoMatch) return `https://cdn1.suno.ai/${sunoMatch[1]}.mp3`
  return url
}

export async function addSong(title: string, url: string, addedBy?: string): Promise<SongRecord> {
  const db = requireDatabase()
  const songRef = push(ref(db, 'songs'))
  const id = songRef.key

  if (!id) throw new Error('Kunne ikke opprette sang-ID.')

  const song: SongRecord = {
    id,
    title: title.trim(),
    url: normalizeSongUrl(url.trim()),
    ...(addedBy ? { addedBy } : {}),
    createdAt: new Date().toISOString(),
  }

  await set(songRef, song)
  return song
}

// Kopierer lagets offisielle lagsang inn i songs-tabellen, inkludert total
// avspillingsteller og per-bruker-statistikk hentet fra brukernes songPlays.
export async function archiveTeamSongToSongs(team: TeamRecord): Promise<SongRecord | null> {
  if (!team.songUrl) return null
  const db = requireDatabase()

  const usersSnapshot = await get(ref(db, 'users'))
  const userPlays: Record<string, number> = {}
  if (usersSnapshot.exists()) {
    const users = usersSnapshot.val() as Record<string, UserProfile>
    for (const [uid, user] of Object.entries(users)) {
      const plays = user.songPlays?.[team.id]
      if (typeof plays === 'number' && plays > 0) userPlays[uid] = plays
    }
  }

  const songRef = push(ref(db, 'songs'))
  const id = songRef.key
  if (!id) throw new Error('Kunne ikke opprette sang-ID.')

  const song: SongRecord = {
    id,
    title: team.songTitle || team.name,
    url: team.songUrl,
    ...(team.songPlayCount ? { playCount: team.songPlayCount } : {}),
    ...(Object.keys(userPlays).length > 0 ? { userPlays } : {}),
    ...(team.songAddedBy ? { addedBy: team.songAddedBy } : {}),
    createdAt: new Date().toISOString(),
  }

  await set(songRef, song)
  return song
}

export async function incrementSongPlayCount(songId: string, userId?: string): Promise<void> {
  const updates: Record<string, unknown> = { playCount: increment(1) }
  if (userId) {
    updates[`userPlays/${userId}`] = increment(1)
  }
  await update(ref(requireDatabase(), `songs/${songId}`), updates)
}

export async function deleteSong(songId: string): Promise<void> {
  await remove(ref(requireDatabase(), `songs/${songId}`))
}
