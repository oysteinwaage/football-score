import { get, push, ref, set, update } from 'firebase/database'

import { database, firebaseConfigError } from '../firebase/config'
import { TeamRecord } from '../types/domain'

function requireDatabase() {
  if (!database) {
    throw new Error(firebaseConfigError ?? 'Firebase er ikke konfigurert.')
  }

  return database
}

export interface CreateTeamInput {
  name: string
  playerNames: string[]
  coachNames: string[]
}

export async function createTeam(input: CreateTeamInput): Promise<TeamRecord> {
  const db = requireDatabase()
  const teamRef = push(ref(db, 'teams'))
  const id = teamRef.key

  if (!id) {
    throw new Error('Kunne ikke opprette lag-ID.')
  }

  const now = new Date().toISOString()
  const team: TeamRecord = {
    id,
    name: input.name,
    playerNames: input.playerNames,
    coachNames: input.coachNames,
    matchIds: [],
    createdAt: now,
    updatedAt: now,
  }

  await set(teamRef, team)
  return team
}

export async function addMatchReferenceToTeam(teamId: string, matchId: string): Promise<void> {
  const db = requireDatabase()
  const teamPath = ref(db, `teams/${teamId}`)
  const snapshot = await get(teamPath)

  if (!snapshot.exists()) {
    throw new Error('Fant ikke laget som kampen skulle knyttes til.')
  }

  const currentTeam = snapshot.val() as TeamRecord
  const nextMatchIds = Array.from(new Set([...(currentTeam.matchIds ?? []), matchId]))

  await update(teamPath, {
    matchIds: nextMatchIds,
    updatedAt: new Date().toISOString(),
  })
}

export async function updateTeamSong(teamId: string, songUrl: string | null, songTitle?: string): Promise<void> {
  await update(ref(requireDatabase(), `teams/${teamId}`), {
    songUrl: songUrl ?? null,
    songTitle: songTitle ?? null,
    updatedAt: new Date().toISOString(),
  })
}

export async function updateTeamName(teamId: string, name: string): Promise<void> {
  await update(ref(requireDatabase(), `teams/${teamId}`), {
    name,
    updatedAt: new Date().toISOString(),
  })
}

export async function updateTeamRoster(teamId: string, playerNames: string[], coachNames: string[]): Promise<void> {
  await update(ref(requireDatabase(), `teams/${teamId}`), {
    playerNames,
    coachNames,
    updatedAt: new Date().toISOString(),
  })
}

export async function removeMatchReferenceFromTeam(teamId: string, matchId: string): Promise<void> {
  const db = requireDatabase()
  const teamPath = ref(db, `teams/${teamId}`)
  const snapshot = await get(teamPath)

  if (!snapshot.exists()) {
    throw new Error('Fant ikke laget som kampen skulle fjernes fra.')
  }

  const currentTeam = snapshot.val() as TeamRecord
  const nextMatchIds = (currentTeam.matchIds ?? []).filter((currentMatchId) => currentMatchId !== matchId)

  await update(teamPath, {
    matchIds: nextMatchIds,
    updatedAt: new Date().toISOString(),
  })
}
