import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import FlagRoundedIcon from '@mui/icons-material/FlagRounded'
import PauseCircleRoundedIcon from '@mui/icons-material/PauseCircleRounded'
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded'
import SportsScoreRoundedIcon from '@mui/icons-material/SportsScoreRounded'
import StopCircleRoundedIcon from '@mui/icons-material/StopCircleRounded'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { useDocument } from '../hooks/useRealtimeDatabase'
import { updateMatch } from '../services/matchService'
import { MatchEvent, MatchEventType, MatchRecord, MatchStatus, UserRole } from '../types/domain'
import { formatMatchTime, getLiveElapsedSeconds } from '../utils/matchClock'

function createEvent(
  type: MatchEventType,
  text: string,
  matchSecond: number,
  scoreAfter?: MatchRecord['score'],
): MatchEvent {
  return {
    id: crypto.randomUUID(),
    type,
    text,
    createdAt: new Date().toISOString(),
    matchSecond,
    scoreAfter,
  }
}

export function MatchPage() {
  const { matchId = '' } = useParams()
  const { profile } = useAuth()
  const { data: match, loading, error } = useDocument<MatchRecord>(matchId ? `matches/${matchId}` : null)
  const [clockSeconds, setClockSeconds] = useState(0)
  const [homeScorer, setHomeScorer] = useState('')
  const [awayScorer, setAwayScorer] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const canManage = Boolean(profile?.roles.some((role) => role === UserRole.ADMIN || role === UserRole.KAMPLEDER || role === UserRole.TRENER))
  const hasAccess = Boolean(profile && (profile.roles.includes(UserRole.ADMIN) || (match && profile.teamIds.includes(match.teamId))))

  useEffect(() => {
    if (!match) {
      return
    }

    setClockSeconds(getLiveElapsedSeconds(match.clock))

    const interval = window.setInterval(() => {
      setClockSeconds(getLiveElapsedSeconds(match.clock))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [match])

  const sortedEvents = useMemo(
    () => [...(match?.events ?? [])].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [match?.events],
  )

  if (loading) {
    return <Alert severity="info">Laster kamp...</Alert>
  }

  if (error || !match) {
    return <Alert severity="error">Fant ikke kampen.</Alert>
  }

  if (!hasAccess) {
    return <Alert severity="error">Du har ikke tilgang til denne kampen.</Alert>
  }

  const persistMatch = async (nextMatch: MatchRecord, successMessage: string) => {
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await updateMatch(nextMatch.id, nextMatch)
      setStatusMessage(successMessage)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Kunne ikke oppdatere kampen.')
    }
  }

  const startMatch = async () => {
    const nextMatch: MatchRecord = {
      ...match,
      clock: {
        status: MatchStatus.FIRST_HALF,
        elapsedSeconds: 0,
        startedAt: new Date().toISOString(),
      },
      events: [...match.events, createEvent(MatchEventType.MATCH_STARTED, 'Kampen startet', 0)],
    }

    await persistMatch(nextMatch, 'Kampen er startet.')
  }

  const pauseMatch = async () => {
    const elapsedSeconds = getLiveElapsedSeconds(match.clock)
    const nextMatch: MatchRecord = {
      ...match,
      clock: {
        status: MatchStatus.HALF_TIME,
        elapsedSeconds,
        startedAt: null,
      },
      events: [...match.events, createEvent(MatchEventType.MATCH_PAUSED, 'Kampen pauset', elapsedSeconds)],
    }

    await persistMatch(nextMatch, 'Kampen er satt på pause.')
  }

  const startSecondHalf = async () => {
    const nextMatch: MatchRecord = {
      ...match,
      clock: {
        status: MatchStatus.SECOND_HALF,
        elapsedSeconds: 25 * 60,
        startedAt: new Date().toISOString(),
      },
      events: [...match.events, createEvent(MatchEventType.SECOND_HALF_STARTED, '2. omgang startet', 25 * 60)],
    }

    await persistMatch(nextMatch, 'Andre omgang er startet.')
  }

  const endMatch = async () => {
    const nextMatch: MatchRecord = {
      ...match,
      clock: {
        status: MatchStatus.FINISHED,
        elapsedSeconds: 50 * 60,
        startedAt: null,
      },
      events: [...match.events, createEvent(MatchEventType.MATCH_ENDED, 'Kampen avsluttet', 50 * 60, match.score)],
    }

    await persistMatch(nextMatch, 'Kampen er avsluttet.')
  }

  const registerGoal = async (team: 'home' | 'away', scorerName: string) => {
    const elapsedSeconds = getLiveElapsedSeconds(match.clock)
    const score = {
      home: team === 'home' ? match.score.home + 1 : match.score.home,
      away: team === 'away' ? match.score.away + 1 : match.score.away,
    }
    const scorer = scorerName.trim() || 'Ukjent spiller'
    const text = `${scorer} scoret for ${team === 'home' ? match.homeTeam : match.awayTeam}. Stillingen er nå ${score.home} - ${score.away}.`
    const eventType = team === 'home' ? MatchEventType.GOAL_HOME : MatchEventType.GOAL_AWAY
    const nextMatch: MatchRecord = {
      ...match,
      score,
      events: [...match.events, createEvent(eventType, text, elapsedSeconds, score)],
    }

    await persistMatch(nextMatch, 'Målet er registrert.')
    if (team === 'home') {
      setHomeScorer('')
    } else {
      setAwayScorer('')
    }
  }

  const removeGoalEvent = async (eventId: string) => {
    const nextEvents = match.events.filter((e) => e.id !== eventId)
    const nextScore = {
      home: nextEvents.filter((e) => e.type === MatchEventType.GOAL_HOME).length,
      away: nextEvents.filter((e) => e.type === MatchEventType.GOAL_AWAY).length,
    }
    await persistMatch({ ...match, events: nextEvents, score: nextScore }, 'Målhendelsen er fjernet.')
  }

  const isScheduled = match.clock.status === MatchStatus.SCHEDULED
  const isFirstHalf = match.clock.status === MatchStatus.FIRST_HALF
  const isHalfTime = match.clock.status === MatchStatus.HALF_TIME
  const isFinished = match.clock.status === MatchStatus.FINISHED
  const isOvertime =
    ((isFirstHalf || isHalfTime) && clockSeconds > 25 * 60) ||
    clockSeconds > 50 * 60

  return (
    <Stack spacing={3}>
      {statusMessage && <Alert severity="success">{statusMessage}</Alert>}
      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h4">{match.homeTeam} - {match.awayTeam}</Typography>
            <Typography color="text.secondary">
              {new Date(match.startsAt).toLocaleString('nb-NO')} · {match.location || 'Sted ikke satt'}
            </Typography>
            <Typography variant="h1" sx={{ fontSize: { xs: '3.5rem', md: '5rem' } }}>
              {match.score.home} - {match.score.away}
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Typography variant="h3" color={isOvertime ? 'error.main' : 'primary.main'}>
                {formatMatchTime(clockSeconds)}
              </Typography>
              {isOvertime && !isHalfTime && <Chip label="Overtid" color="error" />}
              {isHalfTime && <Chip label="Pause" color="warning" />}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {canManage && !isFinished && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, lg: 5 }}>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h5">Kampkontroller</Typography>
                  {isScheduled && (
                    <Button variant="contained" startIcon={<PlayCircleRoundedIcon />} onClick={() => void startMatch()}>
                      Start kamp
                    </Button>
                  )}
                  {isFirstHalf && (
                    <Button variant="contained" color="warning" startIcon={<PauseCircleRoundedIcon />} onClick={() => void pauseMatch()}>
                      Pause
                    </Button>
                  )}
                  {isHalfTime && (
                    <Button variant="contained" color="secondary" startIcon={<FlagRoundedIcon />} onClick={() => void startSecondHalf()}>
                      Start 2. omgang
                    </Button>
                  )}
                  {!isFinished && !isScheduled && (
                    <Button variant="outlined" color="error" startIcon={<StopCircleRoundedIcon />} onClick={() => void endMatch()}>
                      Avslutt kamp
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 7 }}>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h5">Registrer scoring</Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Stack spacing={1.5}>
                        <TextField label={`Målscorer (${match.homeTeam})`} value={homeScorer} onChange={(event) => setHomeScorer(event.target.value)} />
                        <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => void registerGoal('home', homeScorer)} disabled={isFinished || isScheduled}>
                          Registrer hjemmemål
                        </Button>
                      </Stack>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Stack spacing={1.5}>
                        <TextField label={`Målscorer (${match.awayTeam})`} value={awayScorer} onChange={(event) => setAwayScorer(event.target.value)} />
                        <Button variant="outlined" startIcon={<SportsScoreRoundedIcon />} onClick={() => void registerGoal('away', awayScorer)} disabled={isFinished || isScheduled}>
                          Registrer bortemål
                        </Button>
                      </Stack>
                    </Grid>
                  </Grid>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5">Kamphendelser</Typography>
            {sortedEvents.length === 0 ? (
              <Alert severity="info">Ingen hendelser registrert ennå.</Alert>
            ) : (
              <List disablePadding>
                {sortedEvents.map((event) => {
                  const isGoal = event.type === MatchEventType.GOAL_HOME || event.type === MatchEventType.GOAL_AWAY
                  return (
                    <ListItem key={event.id} divider disableGutters sx={{ pr: canManage && isGoal ? 6 : 0 }}>
                      <ListItemText
                        primary={event.text}
                        secondary={`${formatMatchTime(event.matchSecond)} · ${new Date(event.createdAt).toLocaleTimeString('nb-NO')}`}
                      />
                      {canManage && isGoal && (
                        <ListItemSecondaryAction>
                          <Tooltip title="Fjern målhendelse">
                            <IconButton edge="end" size="small" color="error" onClick={() => void removeGoalEvent(event.id)}>
                              <DeleteRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </ListItemSecondaryAction>
                      )}
                    </ListItem>
                  )
                })}
              </List>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
