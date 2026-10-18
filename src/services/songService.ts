import { get, increment, push, ref, remove, set, update } from 'firebase/database'
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'

import { database, firebaseConfigError, storage } from '../firebase/config'
import { SongRecord, TeamRecord, UserProfile } from '../types/domain'
import { removeCachedAudio } from '../utils/audioCache'
import { hasTeamSong } from '../utils/songUrl'

const MAX_MP3_BYTES = 25 * 1024 * 1024

function requireDatabase() {
  if (!database) {
    throw new Error(firebaseConfigError ?? 'Firebase er ikke konfigurert.')
  }
  return database
}

function requireStorage() {
  if (!storage) {
    throw new Error(firebaseConfigError ?? 'Firebase er ikke konfigurert.')
  }
  return storage
}

export type UploadedMp3 = { mp3Url: string; mp3Path: string }

export function validateMp3File(file: File): string | null {
  const isMp3 = file.type === 'audio/mpeg' || file.type === 'audio/mp3' || file.name.toLowerCase().endsWith('.mp3')
  if (!isMp3) return 'Filen må være en .mp3-fil.'
  if (file.size > MAX_MP3_BYTES) return 'Filen er for stor (maks 25 MB).'
  return null
}

// Laster opp en mp3-fil til Sanger-mappen i Storage. Filnavnet er alltid unikt,
// slik at en lagret URL aldri peker på endret innhold og trygt kan caches for alltid.
export async function uploadSongMp3(file: File): Promise<UploadedMp3> {
  const validationError = validateMp3File(file)
  if (validationError) throw new Error(validationError)

  const baseName = file.name
    .replace(/\.mp3$/i, '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'sang'
  const mp3Path = `Sanger/${Date.now()}-${baseName}.mp3`
  const fileRef = storageRef(requireStorage(), mp3Path)
  await uploadBytes(fileRef, file, {
    contentType: 'audio/mpeg',
    cacheControl: 'public, max-age=31536000, immutable',
  })
  const mp3Url = await getDownloadURL(fileRef)
  return { mp3Url, mp3Path }
}

export async function deleteSongMp3(mp3Path?: string, mp3Url?: string): Promise<void> {
  if (mp3Url) void removeCachedAudio(mp3Url)
  if (!mp3Path || !storage) return
  try {
    await deleteObject(storageRef(storage, mp3Path))
  } catch {
    // Filen finnes ikke i Storage — fortsett uansett
  }
}

export async function addSong(title: string, url: string, addedBy?: string, mp3File?: File): Promise<SongRecord> {
  const db = requireDatabase()
  const songRef = push(ref(db, 'songs'))
  const id = songRef.key

  if (!id) throw new Error('Kunne ikke opprette sang-ID.')

  const mp3 = mp3File ? await uploadSongMp3(mp3File) : null

  const song: SongRecord = {
    id,
    title: title.trim(),
    url: url.trim(),
    ...(mp3 ?? {}),
    ...(addedBy ? { addedBy } : {}),
    createdAt: new Date().toISOString(),
  }

  await set(songRef, song)
  return song
}

// Kopierer lagets offisielle lagsang inn i songs-tabellen, inkludert total
// avspillingsteller og per-bruker-statistikk hentet fra brukernes songPlays.
export async function archiveTeamSongToSongs(team: TeamRecord): Promise<SongRecord | null> {
  if (!hasTeamSong(team)) return null
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
    url: team.songUrl ?? '',
    ...(team.songMp3Url && team.songMp3Path ? { mp3Url: team.songMp3Url, mp3Path: team.songMp3Path } : {}),
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

// Laster opp mp3 for en eksisterende sang (f.eks. en som bare har Suno-lenke)
export async function attachMp3ToSong(songId: string, file: File): Promise<void> {
  const mp3 = await uploadSongMp3(file)
  try {
    await update(ref(requireDatabase(), `songs/${songId}`), mp3)
  } catch (e) {
    await deleteSongMp3(mp3.mp3Path)
    throw e
  }
}

export async function deleteSong(song: SongRecord): Promise<void> {
  await remove(ref(requireDatabase(), `songs/${song.id}`))
  await deleteSongMp3(song.mp3Path, song.mp3Url)
}
