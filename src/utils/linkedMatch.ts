import { MatchRecord, TeamRecord } from '../types/domain'

export type MatchSide = 'home' | 'away'

const LINK_MAX_START_DIFF_MS = 30 * 60 * 1000

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function tokenOverlap(teamName: string, sideName: string) {
  const sideTokens = new Set(normalizeName(sideName).split(' '))
  return normalizeName(teamName).split(' ').filter((token) => sideTokens.has(token)).length
}

/** Finner hvilken side (hjemme/borte) et lag spiller på i en kamp. Faller tilbake på hjemme ved tvil. */
export function resolveTeamSide(match: Pick<MatchRecord, 'homeTeam' | 'awayTeam'>, teamName: string | undefined): MatchSide {
  if (!teamName) return 'home'
  const name = normalizeName(teamName)
  if (normalizeName(match.awayTeam) === name) return 'away'
  if (normalizeName(match.homeTeam) === name) return 'home'
  return tokenOverlap(teamName, match.awayTeam) > tokenOverlap(teamName, match.homeTeam) ? 'away' : 'home'
}

/**
 * Finner "tvillingkampen" når to av appens egne lag møter hverandre: samme hjemme-/bortelag,
 * (nesten) samme starttid, men registrert på det andre laget – som spiller på motsatt side.
 */
export function findLinkedMatch(
  match: MatchRecord,
  allMatches: MatchRecord[],
  teams: TeamRecord[],
): MatchRecord | null {
  const team = teams.find((t) => t.id === match.teamId)
  if (!team) return null
  const ourSide = resolveTeamSide(match, team.name)
  const startsAt = new Date(match.startsAt).getTime()

  let best: MatchRecord | null = null
  let bestDiff = Infinity
  for (const candidate of allMatches) {
    if (candidate.id === match.id || candidate.teamId === match.teamId) continue
    if (normalizeName(candidate.homeTeam) !== normalizeName(match.homeTeam)) continue
    if (normalizeName(candidate.awayTeam) !== normalizeName(match.awayTeam)) continue
    const diff = Math.abs(new Date(candidate.startsAt).getTime() - startsAt)
    if (diff > LINK_MAX_START_DIFF_MS || diff >= bestDiff) continue
    const candidateTeam = teams.find((t) => t.id === candidate.teamId)
    if (!candidateTeam || candidateTeam.retired) continue
    // Lagene må spille på hver sin side av kampen
    if (resolveTeamSide(candidate, candidateTeam.name) === ourSide) continue
    best = candidate
    bestDiff = diff
  }
  return best
}
