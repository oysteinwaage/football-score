import { get, push, ref, remove, set, update } from 'firebase/database'

import { database, firebaseConfigError } from '../firebase/config'
import { TeamRecord, TeamType, UserProfile, UserRole } from '../types/domain'

function requireDatabase() {
  if (!database) {
    throw new Error(firebaseConfigError ?? 'Firebase er ikke konfigurert.')
  }

  return database
}

export interface CreateTeamInput {
  name: string
  teamType: TeamType
  cupName?: string
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
    teamType: input.teamType,
    ...(input.cupName ? { cupName: input.cupName } : {}),
    playerNames: input.playerNames,
    coachNames: input.coachNames,
    matchIds: [],
    createdAt: now,
    updatedAt: now,
  }

  await set(teamRef, team)

  const usersSnapshot = await get(ref(db, 'users'))
  if (usersSnapshot.exists()) {
    const users = usersSnapshot.val() as Record<string, UserProfile>
    await Promise.all(
      Object.entries(users)
        .filter(([, user]) => user.roles?.some((role) => role === UserRole.ADMIN || role === UserRole.TRENER))
        .filter(([, user]) => !user.teamIds?.includes(id))
        .map(([uid, user]) =>
          update(ref(db, `users/${uid}`), {
            teamIds: [...(user.teamIds ?? []), id],
            updatedAt: new Date().toISOString(),
          }),
        ),
    )
  }

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

export async function updateTeamName(teamId: string, name: string, cupName?: string | null): Promise<void> {
  await update(ref(requireDatabase(), `teams/${teamId}`), {
    name,
    ...(cupName !== undefined ? { cupName: cupName ?? null } : {}),
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

export async function updateTeamHalfDuration(teamId: string, halfDurationMinutes: number): Promise<void> {
  await update(ref(requireDatabase(), `teams/${teamId}`), {
    halfDurationMinutes,
    updatedAt: new Date().toISOString(),
  })
}

export async function updateTeamRequireScorerModal(teamId: string, requireScorerModal: boolean): Promise<void> {
  await update(ref(requireDatabase(), `teams/${teamId}`), {
    requireScorerModal,
    updatedAt: new Date().toISOString(),
  })
}

export async function updateTeamShowScorerInEvents(teamId: string, showScorerInEvents: boolean): Promise<void> {
  await update(ref(requireDatabase(), `teams/${teamId}`), {
    showScorerInEvents,
    updatedAt: new Date().toISOString(),
  })
}

export async function updateTeamShowScorerInEventsForCoach(teamId: string, showScorerInEventsForCoach: boolean): Promise<void> {
  await update(ref(requireDatabase(), `teams/${teamId}`), {
    showScorerInEventsForCoach,
    updatedAt: new Date().toISOString(),
  })
}

export async function retireTeam(teamId: string, retired: boolean): Promise<void> {
  await update(ref(requireDatabase(), `teams/${teamId}`), {
    retired,
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteTeam(teamId: string): Promise<void> {
  const db = requireDatabase()

  // Delete all matches belonging to this team
  const teamSnapshot = await get(ref(db, `teams/${teamId}`))
  const team = teamSnapshot.val() as TeamRecord | null
  if (team?.matchIds?.length) {
    await Promise.all(team.matchIds.map((matchId) => remove(ref(db, `matches/${matchId}`))))
  }

  // Remove teamId from all users
  const usersSnapshot = await get(ref(db, 'users'))
  if (usersSnapshot.exists()) {
    const users = usersSnapshot.val() as Record<string, UserProfile>
    await Promise.all(
      Object.entries(users)
        .filter(([, user]) => user.teamIds?.includes(teamId))
        .map(([uid, user]) =>
          update(ref(db, `users/${uid}`), {
            teamIds: user.teamIds.filter((id) => id !== teamId),
            updatedAt: new Date().toISOString(),
          }),
        ),
    )
  }

  // Delete the team itself
  await remove(ref(db, `teams/${teamId}`))
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
