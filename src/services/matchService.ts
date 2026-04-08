import { push, ref, remove, set, update } from 'firebase/database'

import { database, firebaseConfigError } from '../firebase/config'
import { ImportedFixture, MatchRecord, MatchStatus } from '../types/domain'
import { addMatchReferenceToTeam, removeMatchReferenceFromTeam } from './teamService'

function requireDatabase() {
  if (!database) {
    throw new Error(firebaseConfigError ?? 'Firebase er ikke konfigurert.')
  }

  return database
}

function omitUndefined<T extends object>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((entryValue) => entryValue !== undefined)
      .map((entryValue) =>
        typeof entryValue === 'object' && entryValue !== null
          ? omitUndefined(entryValue)
          : entryValue,
      ) as T
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [
        key,
        typeof entryValue === 'object' && entryValue !== null
          ? omitUndefined(entryValue)
          : entryValue,
      ]),
  ) as T
}

export interface CreateMatchInput {
  teamId: string
  startsAt: string
  homeTeam: string
  awayTeam: string
  location?: string
  externalSourceId?: string
  importedFromUrl?: string
}

export async function createMatch(input: CreateMatchInput): Promise<MatchRecord> {
  const db = requireDatabase()
  const matchRef = push(ref(db, 'matches'))
  const id = matchRef.key

  if (!id) {
    throw new Error('Kunne ikke opprette kamp-ID.')
  }

  const now = new Date().toISOString()
  const match: MatchRecord = {
    id,
    teamId: input.teamId,
    startsAt: input.startsAt,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    location: input.location ?? '',
    score: { home: 0, away: 0 },
    clock: {
      status: MatchStatus.SCHEDULED,
      elapsedSeconds: 0,
      startedAt: null,
    },
    events: [],
    createdAt: now,
    updatedAt: now,
    externalSourceId: input.externalSourceId,
    importedFromUrl: input.importedFromUrl,
  }

  await set(matchRef, omitUndefined(match))
  await addMatchReferenceToTeam(input.teamId, id)
  return match
}

export async function updateMatch(matchId: string, updates: Partial<MatchRecord>): Promise<void> {
  await update(
    ref(requireDatabase(), `matches/${matchId}`),
    omitUndefined({
      ...updates,
      updatedAt: new Date().toISOString(),
    }),
  )
}

export async function deleteMatch(matchId: string, teamId: string): Promise<void> {
  await remove(ref(requireDatabase(), `matches/${matchId}`))
  await removeMatchReferenceFromTeam(teamId, matchId)
}

export async function importFixtures(
  teamId: string,
  fixtures: ImportedFixture[],
  existingExternalIds: string[],
): Promise<number> {
  let createdCount = 0

  for (const fixture of fixtures) {
    if (existingExternalIds.includes(fixture.externalSourceId)) {
      continue
    }

    await createMatch({
      teamId,
      startsAt: fixture.startsAt,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      location: fixture.location,
      externalSourceId: fixture.externalSourceId,
      importedFromUrl: fixture.sourceUrl,
    })
    createdCount += 1
  }

  return createdCount
}
