import {
  MatchEventType,
  MatchStatus,
  UserRole,
  type GoalScorer,
  type MatchClock,
  type MatchEvent,
  type MatchRecord,
  type MatchScore,
  type TeamRecord,
  type UserProfile,
} from '../types/domain'

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function toMatchScore(value: unknown): MatchScore {
  const source = typeof value === 'object' && value !== null ? (value as Partial<MatchScore>) : {}

  return {
    home: typeof source.home === 'number' ? source.home : 0,
    away: typeof source.away === 'number' ? source.away : 0,
  }
}

function toMatchClock(value: unknown): MatchClock {
  const source = typeof value === 'object' && value !== null ? (value as Partial<MatchClock>) : {}

  return {
    status: Object.values(MatchStatus).includes(source.status as MatchStatus)
      ? (source.status as MatchStatus)
      : MatchStatus.SCHEDULED,
    elapsedSeconds: typeof source.elapsedSeconds === 'number' ? source.elapsedSeconds : 0,
    startedAt: typeof source.startedAt === 'string' ? source.startedAt : null,
  }
}

function toMatchEvents(value: unknown): MatchEvent[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) {
      return []
    }

    const candidate = item as Partial<MatchEvent>
    if (typeof candidate.id !== 'string' || typeof candidate.text !== 'string') {
      return []
    }

    return [
      {
        id: candidate.id,
        type: Object.values(MatchEventType).includes(candidate.type as MatchEventType)
          ? (candidate.type as MatchEventType)
          : MatchEventType.INFO,
        text: candidate.text,
        createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date(0).toISOString(),
        matchSecond: typeof candidate.matchSecond === 'number' ? candidate.matchSecond : 0,
        scoreAfter: candidate.scoreAfter ? toMatchScore(candidate.scoreAfter) : undefined,
        scorerName: typeof candidate.scorerName === 'string' ? candidate.scorerName : undefined,
      },
    ]
  })
}

function toGoalScorers(value: unknown): GoalScorer[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return []
    const candidate = item as Partial<GoalScorer>
    if (typeof candidate.name !== 'string' || typeof candidate.goals !== 'number') return []
    return [{ name: candidate.name, goals: candidate.goals }]
  })
}

export function normalizeUserProfile(value: unknown, id: string): UserProfile {
  const source = typeof value === 'object' && value !== null ? (value as Partial<UserProfile>) : {}
  const roles = Array.isArray(source.roles)
    ? source.roles.filter((role): role is UserRole => Object.values(UserRole).includes(role as UserRole))
    : []

  return {
    id,
    uid: typeof source.uid === 'string' ? source.uid : id,
    email: typeof source.email === 'string' ? source.email : null,
    displayName: typeof source.displayName === 'string' ? source.displayName : null,
    parentName: typeof source.parentName === 'string' ? source.parentName : '',
    childName: typeof source.childName === 'string' ? source.childName : '',
    roles: roles.length > 0 ? roles : [UserRole.FORELDER],
    teamIds: toStringArray(source.teamIds),
    approved: typeof source.approved === 'boolean' ? source.approved : false,
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : new Date(0).toISOString(),
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : new Date(0).toISOString(),
  }
}

export function normalizeTeamRecord(value: unknown, id: string): TeamRecord {
  const source = typeof value === 'object' && value !== null ? (value as Partial<TeamRecord>) : {}

  return {
    id,
    name: typeof source.name === 'string' ? source.name : '',
    playerNames: toStringArray(source.playerNames),
    coachNames: toStringArray(source.coachNames),
    matchIds: toStringArray(source.matchIds),
    songUrl: typeof source.songUrl === 'string' ? source.songUrl : undefined,
    songTitle: typeof source.songTitle === 'string' ? source.songTitle : undefined,
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : new Date(0).toISOString(),
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : new Date(0).toISOString(),
  }
}

export function normalizeMatchRecord(value: unknown, id: string): MatchRecord {
  const source = typeof value === 'object' && value !== null ? (value as Partial<MatchRecord>) : {}

  return {
    id,
    teamId: typeof source.teamId === 'string' ? source.teamId : '',
    startsAt: typeof source.startsAt === 'string' ? source.startsAt : new Date(0).toISOString(),
    homeTeam: typeof source.homeTeam === 'string' ? source.homeTeam : '',
    awayTeam: typeof source.awayTeam === 'string' ? source.awayTeam : '',
    location: typeof source.location === 'string' ? source.location : '',
    score: toMatchScore(source.score),
    clock: toMatchClock(source.clock),
    events: toMatchEvents(source.events),
    playerNames: toStringArray(source.playerNames),
    coachNames: toStringArray(source.coachNames),
    goalScorers: toGoalScorers(source.goalScorers),
    keeperNames: toStringArray(source.keeperNames),
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : new Date(0).toISOString(),
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : new Date(0).toISOString(),
    externalSourceId: typeof source.externalSourceId === 'string' ? source.externalSourceId : undefined,
    importedFromUrl: typeof source.importedFromUrl === 'string' ? source.importedFromUrl : undefined,
  }
}

export function normalizeByPath<T>(path: string, id: string, value: unknown): T & { id: string } {
  if (path === 'users' || path.startsWith('users/')) {
    return normalizeUserProfile(value, id) as unknown as T & { id: string }
  }

  if (path === 'teams' || path.startsWith('teams/')) {
    return normalizeTeamRecord(value, id) as unknown as T & { id: string }
  }

  if (path === 'matches' || path.startsWith('matches/')) {
    return normalizeMatchRecord(value, id) as unknown as T & { id: string }
  }

  return { id, ...(value as object) } as T & { id: string }
}
