import { MatchRecord } from '../types/domain'

export type MatchOutcome = 'win' | 'loss' | 'draw' | 'neutral'

export function getMatchOutcomeForTeam(match: MatchRecord, teamName: string): MatchOutcome {
  const isHomeTeam = match.homeTeam === teamName
  const isAwayTeam = match.awayTeam === teamName

  if (!isHomeTeam && !isAwayTeam) {
    return 'neutral'
  }

  const ourScore = isHomeTeam ? match.score.home : match.score.away
  const opponentScore = isHomeTeam ? match.score.away : match.score.home

  if (ourScore > opponentScore) {
    return 'win'
  }

  if (ourScore < opponentScore) {
    return 'loss'
  }

  return 'draw'
}

export function getMatchOutcomeBackground(outcome: MatchOutcome): string {
  switch (outcome) {
    case 'win':
      return '#e8f5e9'
    case 'loss':
      return '#ffebee'
    case 'draw':
      return '#fff3e0'
    default:
      return 'grey.100'
  }
}
