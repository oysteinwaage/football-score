export enum TeamType {
  SERIE = 'SERIE',
  CUP = 'CUP',
  TEST = 'TEST',
}

export enum UserRole {
  FORELDER = 'FORELDER',
  ADMIN = 'ADMIN',
  KAMPLEDER = 'KAMPLEDER',
  TRENER = 'TRENER',
  STATS = 'STATS',
}

export enum MatchStatus {
  SCHEDULED = 'SCHEDULED',
  FIRST_HALF = 'FIRST_HALF',
  HALF_TIME = 'HALF_TIME',
  SECOND_HALF = 'SECOND_HALF',
  FINISHED = 'FINISHED',
}

export enum MatchEventType {
  INFO = 'INFO',
  GOAL_HOME = 'GOAL_HOME',
  GOAL_AWAY = 'GOAL_AWAY',
  MATCH_STARTED = 'MATCH_STARTED',
  MATCH_PAUSED = 'MATCH_PAUSED',
  SECOND_HALF_STARTED = 'SECOND_HALF_STARTED',
  MATCH_ENDED = 'MATCH_ENDED',
}

export interface MatchScore {
  home: number
  away: number
}

export interface MatchClock {
  status: MatchStatus
  elapsedSeconds: number
  startedAt: string | null
}

export interface MatchEvent {
  id: string
  type: MatchEventType
  text: string
  createdAt: string
  matchSecond: number
  scoreAfter?: MatchScore
  scorerName?: string
  corrected?: boolean
}

export interface GoalScorer {
  name: string
  goals: number
}

export interface UserProfile {
  id: string
  uid: string
  email: string | null
  displayName: string | null
  parentName: string
  childName: string
  roles: UserRole[]
  teamIds: string[]
  approved: boolean
  createdAt: string
  updatedAt: string
}

export interface TeamRecord {
  id: string
  name: string
  teamType: TeamType
  cupName?: string
  playerNames: string[]
  coachNames: string[]
  matchIds: string[]
  songUrl?: string
  songTitle?: string
  retired?: boolean
  requireScorerModal?: boolean
  showScorerInEvents?: boolean
  createdAt: string
  updatedAt: string
}

export interface MatchRecord {
  id: string
  teamId: string
  startsAt: string
  homeTeam: string
  awayTeam: string
  location: string
  score: MatchScore
  clock: MatchClock
  events: MatchEvent[]
  playerNames: string[]
  coachNames: string[]
  goalScorers: GoalScorer[]
  keeperNames: string[]
  createdAt: string
  updatedAt: string
  externalSourceId?: string
  importedFromUrl?: string
}

export interface ImportedFixture {
  externalSourceId: string
  homeTeam: string
  awayTeam: string
  startsAt: string
  location: string
  sourceUrl?: string
}
