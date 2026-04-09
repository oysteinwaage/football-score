import PlayCircleFilledWhiteRoundedIcon from '@mui/icons-material/PlayCircleFilledWhiteRounded'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { useCollection } from '../hooks/useRealtimeDatabase'
import { updateUserAccess } from '../services/userService'
import { MatchRecord, MatchStatus, TeamRecord, UserProfile, UserRole } from '../types/domain'
import { getMatchOutcomeBackground, getMatchOutcomeForTeam } from '../utils/matchCardColors'
import { formatMatchTime, getLiveElapsedSeconds } from '../utils/matchClock'

function formatDaysUntilMatch(startsAt: string, currentTime: number): string {
  const now = new Date(currentTime)
  const matchDate = new Date(startsAt)

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMatchDay = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate())
  const daysUntil = Math.round((startOfMatchDay.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntil <= 0) {
    return 'I dag'
  }

  return `${daysUntil} dag${daysUntil === 1 ? '' : 'er'} til`
}

export function WelcomePage() {
  const { profile } = useAuth()
  const { data: teams } = useCollection<TeamRecord>('teams')
  const { data: matches } = useCollection<MatchRecord>('matches')
  const { data: users } = useCollection<UserProfile>('users')
  const [currentTime, setCurrentTime] = useState(() => Date.now())
  const [approvalSubmitting, setApprovalSubmitting] = useState(false)
  const [approvalError, setApprovalError] = useState<string | null>(null)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [])

  const isAdmin = profile?.roles.includes(UserRole.ADMIN) ?? false
  const visibleTeams = profile
    ? isAdmin
      ? teams
      : teams.filter((team) => profile.teamIds.includes(team.id))
    : []
  const visibleTeamIds = new Set(visibleTeams.map((team) => team.id))
  const activeMatch =
    matches
      .filter(
        (match) =>
          visibleTeamIds.has(match.teamId) &&
          match.clock.status !== MatchStatus.SCHEDULED &&
          match.clock.status !== MatchStatus.FINISHED,
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
  const activeTeam = activeMatch ? visibleTeams.find((team) => team.id === activeMatch.teamId) ?? null : null
  const upcomingMatchesByTeam = visibleTeams
    .map((team) => {
      const upcomingMatch =
        matches
          .filter(
            (match) =>
              match.teamId === team.id &&
              match.clock.status === MatchStatus.SCHEDULED &&
              new Date(match.startsAt).getTime() >= currentTime,
          )
          .sort((left, right) => left.startsAt.localeCompare(right.startsAt))[0] ?? null

      return upcomingMatch ? { team, match: upcomingMatch } : null
    })
    .filter((entry): entry is { team: TeamRecord; match: MatchRecord } => entry !== null)
  const pendingApprovalUser = isAdmin
    ? users
        .filter((user) => !user.approved)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
    : null

  if (!profile) {
    return null
  }

  const handleApproveUser = async () => {
    if (!pendingApprovalUser) {
      return
    }

    setApprovalSubmitting(true)
    setApprovalError(null)

    try {
      await updateUserAccess(pendingApprovalUser.id, {
        approved: true,
        roles: pendingApprovalUser.roles,
        teamIds: pendingApprovalUser.teamIds,
      })
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : 'Kunne ikke godkjenne brukeren.')
    } finally {
      setApprovalSubmitting(false)
    }
  }

  return (
    <Stack spacing={3}>
      {pendingApprovalUser && (
        <Alert
          severity="info"
          action={
            <Button
              color="inherit"
              size="small"
              variant="outlined"
              disabled={approvalSubmitting}
              onClick={() => void handleApproveUser()}
            >
              {approvalSubmitting ? 'Godkjenner...' : 'Godkjenn bruker'}
            </Button>
          }
        >
          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Ny bruker venter på godkjenning</Typography>
            <Typography variant="body2">
              {pendingApprovalUser.parentName} har registrert seg for {pendingApprovalUser.childName}
              {pendingApprovalUser.email ? ` (${pendingApprovalUser.email})` : ''}.
            </Typography>
          </Stack>
        </Alert>
      )}
      {approvalError && <Alert severity="error">{approvalError}</Alert>}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h4">Hei, {profile.parentName}</Typography>
            <Typography color="text.secondary">
              Herfra kan du navigere til lag, kamper og administrasjon basert på rollene dine.
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {profile.roles.map((role) => (
                <Chip key={role} label={role} color={role === UserRole.ADMIN ? 'primary' : 'default'} />
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {activeMatch && (
        <Card
          component={RouterLink}
          to={`/matches/${activeMatch.id}`}
          sx={{
            textDecoration: 'none',
            color: 'inherit',
            bgcolor: activeTeam
              ? getMatchOutcomeBackground(getMatchOutcomeForTeam(activeMatch, activeTeam.name))
              : 'grey.100',
          }}
        >
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip
                  icon={<PlayCircleFilledWhiteRoundedIcon />}
                  label="Pågående kamp"
                  color="warning"
                  sx={{
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.45 },
                    },
                    animation: 'pulse 1.2s ease-in-out infinite',
                  }}
                />
              </Stack>
              <Typography variant="h6">
                {activeMatch.homeTeam} - {activeMatch.awayTeam}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Typography color="text.secondary">
                  Klokke: {formatMatchTime(getLiveElapsedSeconds(activeMatch.clock, new Date(currentTime)))}
                </Typography>
                <Typography color="text.secondary">
                  Stilling: {activeMatch.score.home} - {activeMatch.score.away}
                </Typography>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5">Dine lag</Typography>
            {visibleTeams.length === 0 ? (
              <Alert severity="info">Du har ikke fått tildelt noen lag enda.</Alert>
            ) : (
              <Stack spacing={1.5}>
                {visibleTeams.map((team) => (
                  <Card key={team.id} variant="outlined" component={RouterLink} to={`/teams/${team.id}`} sx={{ textDecoration: 'none' }}>
                    <CardContent>
                      <Typography variant="h6">{team.name}</Typography>
                      <Typography color="text.secondary">
                        {team.playerNames.length} spillere · {team.coachNames.length} trenere · {team.matchIds.length} kamper
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      {upcomingMatchesByTeam.length > 0 && (
        <Stack spacing={2}>
          {upcomingMatchesByTeam.map(({ team, match }) => (
            <Card key={team.id} component={RouterLink} to={`/matches/${match.id}`} sx={{ textDecoration: 'none', color: 'inherit' }}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography variant="h5">Neste kamp</Typography>
                    <Chip label={team.name} color="secondary" variant="outlined" />
                    <Chip label={formatDaysUntilMatch(match.startsAt, currentTime)} color="primary" variant="outlined" />
                  </Stack>
                  <Typography variant="h6">
                    {match.homeTeam} - {match.awayTeam}
                  </Typography>
                  <Typography color="text.secondary">
                    {new Date(match.startsAt).toLocaleString('nb-NO')} · {match.location || 'Sted ikke satt'}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
