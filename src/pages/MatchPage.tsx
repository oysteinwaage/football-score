import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import FlagRoundedIcon from '@mui/icons-material/FlagRounded'
import PauseCircleRoundedIcon from '@mui/icons-material/PauseCircleRounded'
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded'
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded'
import StopCircleRoundedIcon from '@mui/icons-material/StopCircleRounded'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'

import { RosterCard } from '../components/RosterCard'
import { useAuth } from '../context/AuthContext'
import { useDocument } from '../hooks/useRealtimeDatabase'
import { updateMatch } from '../services/matchService'
import { GoalAssist, GoalScorer, MatchEvent, MatchEventType, MatchRecord, MatchStatus, TeamRecord, UserRole } from '../types/domain'
import { formatMatchTime, getLiveElapsedSeconds } from '../utils/matchClock'

function computeGoalStats(events: MatchEvent[], ourGoalType: MatchEventType): { goalScorers: GoalScorer[]; goalAssists: GoalAssist[] } {
  const scorerCounts: Record<string, number> = {}
  const assistCounts: Record<string, number> = {}
  for (const event of events) {
    if (event.type === ourGoalType) {
      if (event.scorerName) scorerCounts[event.scorerName] = (scorerCounts[event.scorerName] ?? 0) + 1
      if (event.assistName) assistCounts[event.assistName] = (assistCounts[event.assistName] ?? 0) + 1
    }
  }
  return {
    goalScorers: Object.entries(scorerCounts).map(([name, goals]) => ({ name, goals })),
    goalAssists: Object.entries(assistCounts).map(([name, assists]) => ({ name, assists })),
  }
}

function createEvent(
  type: MatchEventType,
  text: string,
  matchSecond: number,
  scoreAfter?: MatchRecord['score'],
  scorerName?: string,
): MatchEvent {
  return {
    id: crypto.randomUUID(),
    type,
    text,
    createdAt: new Date().toISOString(),
    matchSecond,
    scoreAfter,
    scorerName,
  }
}

export function MatchPage() {
  const { matchId = '' } = useParams()
  const { profile } = useAuth()
  const { data: match, loading, error } = useDocument<MatchRecord>(matchId ? `matches/${matchId}` : null)
  const { data: team } = useDocument<TeamRecord>(match ? `teams/${match.teamId}` : null)
  const halfDuration = (team?.halfDurationMinutes ?? 30) * 60
  const fullDuration = halfDuration * 2
  const [clockSeconds, setClockSeconds] = useState(0)
  const [scorerModalOpen, setScorerModalOpen] = useState(false)
  const [pendingScorer, setPendingScorer] = useState('')
  const [assistModalOpen, setAssistModalOpen] = useState(false)
  const [infoNote, setInfoNote] = useState('')
  const [endMatchModalOpen, setEndMatchModalOpen] = useState(false)
  const [endMatchNote, setEndMatchNote] = useState('')
  const [endMatchKeepers, setEndMatchKeepers] = useState<string[]>([])
  const [correctionMode, setCorrectionMode] = useState(false)
  const [editMatchOpen, setEditMatchOpen] = useState(false)
  const [editHomeTeam, setEditHomeTeam] = useState('')
  const [editAwayTeam, setEditAwayTeam] = useState('')
  const [editStartsAt, setEditStartsAt] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const canManage = Boolean(profile?.roles.some((role) => role === UserRole.ADMIN || role === UserRole.KAMPLEDER || role === UserRole.TRENER))
  const canEditRoster = Boolean(profile?.roles.some((role) => role === UserRole.ADMIN || role === UserRole.TRENER))
  const isTrenerOrAdmin = Boolean(profile?.roles.some((role) => role === UserRole.ADMIN || role === UserRole.TRENER))
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

  const ourSide: 'home' | 'away' = team?.name === match.awayTeam ? 'away' : 'home'
  const opponentSide: 'home' | 'away' = ourSide === 'home' ? 'away' : 'home'
  const ourTeamName = ourSide === 'home' ? match.homeTeam : match.awayTeam
  const opponentName = ourSide === 'home' ? match.awayTeam : match.homeTeam

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
        elapsedSeconds: halfDuration,
        startedAt: new Date().toISOString(),
      },
      events: [...match.events, createEvent(MatchEventType.SECOND_HALF_STARTED, '2. omgang startet', halfDuration)],
    }

    await persistMatch(nextMatch, 'Andre omgang er startet.')
  }

  const endMatch = async () => {
    const ourGoalType = ourSide === 'home' ? MatchEventType.GOAL_HOME : MatchEventType.GOAL_AWAY
    const { goalScorers, goalAssists } = computeGoalStats(match.events, ourGoalType)

    const matchEndedEvent = createEvent(MatchEventType.MATCH_ENDED, 'Kampen avsluttet', fullDuration, match.score)
    const endEvents: MatchEvent[] = [matchEndedEvent]
    if (endMatchNote.trim()) {
      endEvents.push({
        ...createEvent(MatchEventType.INFO, endMatchNote.trim(), fullDuration),
        createdAt: new Date(new Date(matchEndedEvent.createdAt).getTime() + 1).toISOString(),
      })
    }

    const nextMatch: MatchRecord = {
      ...match,
      clock: {
        status: MatchStatus.FINISHED,
        elapsedSeconds: fullDuration,
        startedAt: null,
      },
      events: [...match.events, ...endEvents],
      goalScorers,
      goalAssists,
      keeperNames: endMatchKeepers,
    }

    setEndMatchModalOpen(false)
    await persistMatch(nextMatch, 'Kampen er avsluttet.')
    setEndMatchNote('')
    setEndMatchKeepers([])
  }

  const registerGoal = async (side: 'home' | 'away', scorerName: string, assistName?: string) => {
    const elapsedSeconds = getLiveElapsedSeconds(match.clock)
    const score = {
      home: side === 'home' ? match.score.home + 1 : match.score.home,
      away: side === 'away' ? match.score.away + 1 : match.score.away,
    }
    const teamName = side === 'home' ? match.homeTeam : match.awayTeam
    const isOpponent = side === opponentSide
    const hasScorer = scorerName.trim().length > 0
    const scorer = scorerName.trim() || 'Ukjent spiller'
    const assistSuffix = !isOpponent && assistName ? ` (assist: ${assistName})` : ''
    const text = isOpponent
      ? `${teamName} scoret. Stillingen er nå ${score.home} - ${score.away}.`
      : hasScorer
        ? `Mål: ${scorer}${assistSuffix} for ${teamName} 🎉 Stillingen er nå ${score.home} - ${score.away}.`
        : `${teamName} scoret 🎉 Stillingen er nå ${score.home} - ${score.away}.`
    const eventType = side === 'home' ? MatchEventType.GOAL_HOME : MatchEventType.GOAL_AWAY
    const storedScorerName = isOpponent || !hasScorer ? undefined : scorer
    const storedAssistName = !isOpponent && assistName ? assistName : undefined
    const newEvent: MatchEvent = {
      ...createEvent(eventType, text, elapsedSeconds, score, storedScorerName),
      ...(storedAssistName ? { assistName: storedAssistName } : {}),
      ...(correctionMode ? { corrected: true } : {}),
    }
    const nextEvents = [...match.events, newEvent]
    const goalStats = isFinished ? computeGoalStats(nextEvents, ourSide === 'home' ? MatchEventType.GOAL_HOME : MatchEventType.GOAL_AWAY) : {}
    const nextMatch: MatchRecord = {
      ...match,
      score,
      events: nextEvents,
      ...goalStats,
    }

    await persistMatch(nextMatch, 'Målet er registrert.')
  }

  const addInfoEvent = async () => {
    const trimmed = infoNote.trim()
    if (!trimmed) return
    await persistMatch(
      { ...match, events: [...match.events, createEvent(MatchEventType.INFO, trimmed, getLiveElapsedSeconds(match.clock))] },
      'Infomeldingen er lagret.',
    )
    setInfoNote('')
  }

  const openEditMatch = () => {
    setEditHomeTeam(match.homeTeam)
    setEditAwayTeam(match.awayTeam)
    const d = new Date(match.startsAt)
    const localStartsAt = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    setEditStartsAt(localStartsAt)
    setEditLocation(match.location ?? '')
    setEditMatchOpen(true)
  }

  const saveEditMatch = async () => {
    setEditMatchOpen(false)
    await persistMatch(
      { ...match, homeTeam: editHomeTeam.trim(), awayTeam: editAwayTeam.trim(), startsAt: new Date(editStartsAt).toISOString(), location: editLocation.trim() },
      'Kampinfo er oppdatert.',
    )
  }

  const removeGoalEvent = async (eventId: string) => {
    const nextEvents = match.events.filter((e) => e.id !== eventId)
    const nextScore = {
      home: nextEvents.filter((e) => e.type === MatchEventType.GOAL_HOME).length,
      away: nextEvents.filter((e) => e.type === MatchEventType.GOAL_AWAY).length,
    }
    const ourGoalType = ourSide === 'home' ? MatchEventType.GOAL_HOME : MatchEventType.GOAL_AWAY
    const { goalScorers, goalAssists } = computeGoalStats(nextEvents, ourGoalType)
    await persistMatch({ ...match, events: nextEvents, score: nextScore, goalScorers, goalAssists }, 'Målhendelsen er fjernet.')
  }

  const removeInfoEvent = async (eventId: string) => {
    const nextEvents = match.events.filter((e) => e.id !== eventId)
    await persistMatch({ ...match, events: nextEvents }, 'Hendelsen er fjernet.')
  }

  const matchPlayerNames = match.playerNames ?? []
  const matchCoachNames = match.coachNames ?? []

  const handleRemoveMatchCoach = async (name: string) => {
    await persistMatch({ ...match, coachNames: matchCoachNames.filter((c) => c !== name) }, 'Trener fjernet fra kampen.')
  }

  const handleAddMatchCoach = async (name: string) => {
    await persistMatch({ ...match, coachNames: [...matchCoachNames, name] }, 'Trener lagt til på kampen.')
  }

  const handleRemoveMatchPlayer = async (name: string) => {
    await persistMatch({ ...match, playerNames: matchPlayerNames.filter((p) => p !== name) }, 'Spiller fjernet fra kampen.')
  }

  const handleAddMatchPlayer = async (name: string) => {
    await persistMatch({ ...match, playerNames: [...matchPlayerNames, name] }, 'Spiller lagt til på kampen.')
  }

  const coachSuggestions = (team?.coachNames ?? []).filter((name) => !matchCoachNames.includes(name))
  const playerSuggestions = (team?.playerNames ?? []).filter((name) => !matchPlayerNames.includes(name))

  const isScheduled = match.clock.status === MatchStatus.SCHEDULED
  const isFirstHalf = match.clock.status === MatchStatus.FIRST_HALF
  const isHalfTime = match.clock.status === MatchStatus.HALF_TIME
  const isFinished = match.clock.status === MatchStatus.FINISHED
  const isPreMatch = isScheduled && Date.now() >= new Date(match.startsAt).getTime() - 30 * 60 * 1000
  const isOvertime =
    ((isFirstHalf || isHalfTime) && clockSeconds > halfDuration) ||
    clockSeconds > fullDuration

  return (
    <Stack spacing={3}>
      {team && (
        <Button
          component={RouterLink}
          to={`/teams/${team.id}`}
          startIcon={<ArrowBackRoundedIcon />}
          sx={{ alignSelf: 'flex-start', my: -3 }}
        >
          {team.name}
        </Button>
      )}
      {statusMessage && <Alert severity="success">{statusMessage}</Alert>}
      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <Typography variant="h4">{match.homeTeam} - {match.awayTeam}</Typography>
              {canEditRoster && (
                <Tooltip title="Rediger kampinfo">
                  <IconButton size="small" onClick={openEditMatch}>
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
            <Typography color="text.secondary">
              {(([first, ...rest]) => first.toUpperCase() + rest.join(''))(new Date(match.startsAt).toLocaleString('nb-NO', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }))} · {match.location || 'Sted ikke satt'}
            </Typography>
            <Typography variant="h1" sx={{ fontSize: { xs: '3.5rem', md: '5rem' }, textAlign: 'center' }}>
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

      {canEditRoster && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <RosterCard
              title="Trenere"
              names={matchCoachNames}
              canEdit={canEditRoster}
              suggestions={coachSuggestions}
              onRemove={handleRemoveMatchCoach}
              onAdd={handleAddMatchCoach}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <RosterCard
              title="Spillere"
              names={matchPlayerNames}
              canEdit={canEditRoster}
              suggestions={playerSuggestions}
              highlightedNames={match.keeperNames ?? []}
              highlightLabel="Keeper"
              onRemove={handleRemoveMatchPlayer}
              onAdd={handleAddMatchPlayer}
            />
          </Grid>
        </Grid>
      )}

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
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<StopCircleRoundedIcon />}
                      onClick={() => { setEndMatchKeepers([]); setEndMatchNote(''); setEndMatchModalOpen(true) }}
                    >
                      Avslutt kamp
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {(isFirstHalf || isHalfTime || match.clock.status === MatchStatus.SECOND_HALF) && <Grid size={{ xs: 12, lg: 7 }}>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h5">Registrer mål</Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Button
                        variant="contained"
                        color="success"
                        fullWidth
                        size="large"
                        onClick={() => team?.requireScorerModal !== false ? setScorerModalOpen(true) : void registerGoal(ourSide, '')}
                        disabled={isFinished || isScheduled || isHalfTime}
                      >
                        Mål {ourTeamName}
                      </Button>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Button
                        variant="contained"
                        color="error"
                        fullWidth
                        size="large"
                        onClick={() => void registerGoal(opponentSide, 'Ukjent')}
                        disabled={isFinished || isScheduled || isHalfTime}
                      >
                        Mål {opponentName}
                      </Button>
                    </Grid>
                  </Grid>
                </Stack>
              </CardContent>
            </Card>
          </Grid>}
        </Grid>
      )}

      {canManage && isFinished && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              {!correctionMode ? (
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<EditRoundedIcon />}
                  onClick={() => setCorrectionMode(true)}
                >
                  Korriger resultat
                </Button>
              ) : (
                <>
                  <Alert severity="warning">Korrigeringsmodus er aktiv. Registrer manglende mål nedenfor.</Alert>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Button
                        variant="contained"
                        color="success"
                        fullWidth
                        size="large"
                        onClick={() => team?.requireScorerModal !== false ? setScorerModalOpen(true) : void registerGoal(ourSide, '')}
                      >
                        Mål {ourTeamName}
                      </Button>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Button
                        variant="contained"
                        color="error"
                        fullWidth
                        size="large"
                        onClick={() => void registerGoal(opponentSide, 'Ukjent')}
                      >
                        Mål {opponentName}
                      </Button>
                    </Grid>
                  </Grid>
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={() => setCorrectionMode(false)}
                  >
                    Avslutt korrigering
                  </Button>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {canManage && (isPreMatch || isFirstHalf || isHalfTime || match.clock.status === MatchStatus.SECOND_HALF) && (
        <Card>
          <CardContent>
            <Stack spacing={2} direction="row" sx={{ alignItems: 'flex-start' }}>
              <TextField
                label="Hva skjer?"
                value={infoNote}
                onChange={(e) => setInfoNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void addInfoEvent()}
                fullWidth
                size="small"
              />
              <Button variant="outlined" onClick={() => void addInfoEvent()} disabled={!infoNote.trim()}>
                Publiser
              </Button>
            </Stack>
          </CardContent>
        </Card>
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
                  const isInfo = event.type === MatchEventType.INFO
                  const eventIcon = {
                    [MatchEventType.GOAL_HOME]: <SportsSoccerRoundedIcon color={ourSide === 'home' ? 'success' : 'error'} />,
                    [MatchEventType.GOAL_AWAY]: <SportsSoccerRoundedIcon color={ourSide === 'away' ? 'success' : 'error'} />,
                    [MatchEventType.MATCH_STARTED]: <PlayCircleRoundedIcon color="primary" />,
                    [MatchEventType.MATCH_PAUSED]: <PauseCircleRoundedIcon color="warning" />,
                    [MatchEventType.SECOND_HALF_STARTED]: <PlayCircleRoundedIcon color="primary" />,
                    [MatchEventType.MATCH_ENDED]: <StopCircleRoundedIcon color="error" />,
                    [MatchEventType.INFO]: <ChatBubbleOutlineRoundedIcon color="action" />,
                  }[event.type]
                  return (
                    <ListItem key={event.id} divider disableGutters sx={{ pr: canManage && (isGoal || isInfo) && (!isFinished || correctionMode) ? 6 : 0 }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>{eventIcon}</ListItemIcon>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                            <span>
                              {team?.showScorerInEvents === false &&
                              !(team?.showScorerInEventsForCoach && isTrenerOrAdmin) &&
                              event.type === (ourSide === 'home' ? MatchEventType.GOAL_HOME : MatchEventType.GOAL_AWAY) &&
                              event.scoreAfter
                                ? `${ourTeamName} scoret 🎉. Stillingen er nå ${event.scoreAfter.home} - ${event.scoreAfter.away}.`
                                : event.text}
                            </span>
                            {event.corrected && <Chip label="Korrigert" size="small" color="warning" variant="outlined" />}
                          </Stack>
                        }
                        secondary={`${formatMatchTime(event.matchSecond)} · ${new Date(event.createdAt).toLocaleTimeString('nb-NO')}`}
                      />
                      {canManage && (isGoal || isInfo) && (!isFinished || correctionMode) && (
                        <ListItemSecondaryAction>
                          <Tooltip title={isGoal ? 'Fjern målhendelse' : 'Fjern hendelse'}>
                            <IconButton
                              edge="end"
                              size="small"
                              color="error"
                              onClick={() => void (isGoal ? removeGoalEvent(event.id) : removeInfoEvent(event.id))}
                            >
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

      <Dialog open={editMatchOpen} onClose={() => setEditMatchOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Rediger kampinfo</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Hjemmelag"
              value={editHomeTeam}
              onChange={(e) => setEditHomeTeam(e.target.value)}
              fullWidth
            />
            <TextField
              label="Bortelag"
              value={editAwayTeam}
              onChange={(e) => setEditAwayTeam(e.target.value)}
              fullWidth
            />
            <TextField
              label="Tidspunkt"
              type="datetime-local"
              value={editStartsAt}
              onChange={(e) => setEditStartsAt(e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Bane / sted"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setEditMatchOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => void saveEditMatch()}
            disabled={!editHomeTeam.trim() || !editAwayTeam.trim() || !editStartsAt}
          >
            Lagre
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={endMatchModalOpen} onClose={() => setEndMatchModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Avslutt kamp</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <TextField
              label="Avsluttende kommentar (valgfritt)"
              value={endMatchNote}
              onChange={(e) => setEndMatchNote(e.target.value)}
              multiline
              rows={2}
              fullWidth
              placeholder="f.eks. God innsats av alle!"
            />
            {matchPlayerNames.length > 0 && (
              <Stack spacing={1}>
                <Typography variant="subtitle2">Hvem har vært keeper?</Typography>
                {matchPlayerNames.map((player) => (
                  <FormControlLabel
                    key={player}
                    control={
                      <Checkbox
                        checked={endMatchKeepers.includes(player)}
                        onChange={() =>
                          setEndMatchKeepers((prev) =>
                            prev.includes(player) ? prev.filter((n) => n !== player) : [...prev, player],
                          )
                        }
                      />
                    }
                    label={player}
                  />
                ))}
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setEndMatchModalOpen(false)}>Avbryt</Button>
          <Button variant="contained" color="error" onClick={() => void endMatch()}>
            Avslutt og lagre kamp
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={scorerModalOpen} onClose={() => setScorerModalOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Hvem scoret for {ourTeamName}?</DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', pt: 1 }}>
            {matchPlayerNames.map((player) => (
              <Chip
                key={player}
                label={player}
                onClick={() => {
                  setScorerModalOpen(false)
                  setPendingScorer(player)
                  setAssistModalOpen(true)
                }}
              />
            ))}
            <Chip
              label="Ukjent spiller"
              variant="outlined"
              onClick={() => {
                setScorerModalOpen(false)
                setPendingScorer('Ukjent spiller')
                setAssistModalOpen(true)
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setScorerModalOpen(false)}>Avbryt</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={assistModalOpen} onClose={() => { setAssistModalOpen(false); void registerGoal(ourSide, pendingScorer) }} fullWidth maxWidth="xs">
        <DialogTitle>Hvem hadde assist?</DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', pt: 1 }}>
            {matchPlayerNames.filter((p) => p !== pendingScorer).map((player) => (
              <Chip
                key={player}
                label={player}
                onClick={() => {
                  setAssistModalOpen(false)
                  void registerGoal(ourSide, pendingScorer, player)
                }}
              />
            ))}
            <Chip
              label="Ingen assist"
              variant="outlined"
              onClick={() => {
                setAssistModalOpen(false)
                void registerGoal(ourSide, pendingScorer)
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => { setAssistModalOpen(false); void registerGoal(ourSide, pendingScorer) }}>Hopp over</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
