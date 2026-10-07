import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded'
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
  Box,
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
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'

import { PhotoEditDialog } from '../components/PhotoEditDialog'
import { RosterCard } from '../components/RosterCard'
import { useAuth } from '../context/AuthContext'
import { useCollection, useDocument } from '../hooks/useRealtimeDatabase'
import { deleteMatchPhoto, updateMatch, updateMatches, uploadMatchPhoto } from '../services/matchService'
import { GoalAssist, GoalScorer, MatchEvent, MatchEventType, MatchRecord, MatchStatus, TeamRecord, UserRole } from '../types/domain'
import { findLinkedMatch, MatchSide, resolveTeamSide } from '../utils/linkedMatch'
import { formatMatchTime, getLiveElapsedSeconds } from '../utils/matchClock'

export const OTHER_LOAN_PLAYER_NAMES = ['Alfred S', 'Jakob', 'Håkon']

const TEAMS_WITHOUT_ATTENDANCE_INFO = ['Vestre Aker G10 Thunder']

function firstName(name: string) {
  return name.split(' ')[0].toLowerCase()
}

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

function buildGoalText(teamName: string, score: MatchRecord['score'], celebrate: boolean, scorer?: string, assist?: string) {
  const suffix = celebrate ? ' 🎉' : '.'
  const scoreText = `Stillingen er nå ${score.home} - ${score.away}.`
  return scorer
    ? `Mål: ${scorer}${assist ? ` (assist: ${assist})` : ''} for ${teamName}${suffix} ${scoreText}`
    : `${teamName} scoret${suffix} ${scoreText}`
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
  const { data: allTeams } = useCollection<TeamRecord>('teams')
  const { data: allMatches } = useCollection<MatchRecord>('matches')
  const halfDuration = (team?.halfDurationMinutes ?? 30) * 60
  const numberOfHalves = match?.numberOfHalves ?? team?.numberOfHalves ?? 2
  const fullDuration = halfDuration * numberOfHalves
  const [clockSeconds, setClockSeconds] = useState(0)
  const [scorerModalOpen, setScorerModalOpen] = useState(false)
  const [pendingScorer, setPendingScorer] = useState('')
  const [goalModalSide, setGoalModalSide] = useState<MatchSide | null>(null)
  const [assistModalOpen, setAssistModalOpen] = useState(false)
  const [infoNote, setInfoNote] = useState('')
  const [endMatchModalOpen, setEndMatchModalOpen] = useState(false)
  const [endMatchNote, setEndMatchNote] = useState('')
  const [endMatchKeepers, setEndMatchKeepers] = useState<string[]>([])
  const [correctionMode, setCorrectionMode] = useState(false)
  const [editingGoalEvent, setEditingGoalEvent] = useState<MatchEvent | null>(null)
  const [editingInfoEvent, setEditingInfoEvent] = useState<MatchEvent | null>(null)
  const [editingInfoText, setEditingInfoText] = useState('')
  const [editMatchOpen, setEditMatchOpen] = useState(false)
  const [editHomeTeam, setEditHomeTeam] = useState('')
  const [editAwayTeam, setEditAwayTeam] = useState('')
  const [editStartsAt, setEditStartsAt] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoDeleting, setPhotoDeleting] = useState(false)
  const [editingPhoto, setEditingPhoto] = useState(false)
  const [resetConfirm1Open, setResetConfirm1Open] = useState(false)
  const [resetConfirm2Open, setResetConfirm2Open] = useState(false)
  const [editingCoachNote, setEditingCoachNote] = useState(false)
  const [coachNoteValue, setCoachNoteValue] = useState('')
  const [coachNoteSaving, setCoachNoteSaving] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

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

  // Når to av appens egne lag møter hverandre finnes kampen på begge lag – disse holdes synkronisert
  const linkedMatch = findLinkedMatch(match, allMatches, allTeams)
  const linkedTeam = linkedMatch ? allTeams.find((t) => t.id === linkedMatch.teamId) ?? null : null
  const canSeeLinkedTeam = Boolean(
    linkedMatch && profile && (profile.roles.includes(UserRole.ADMIN) || profile.teamIds.includes(linkedMatch.teamId)),
  )

  const ourSide: MatchSide = linkedMatch ? resolveTeamSide(match, team?.name) : team?.name === match.awayTeam ? 'away' : 'home'
  const opponentSide: MatchSide = ourSide === 'home' ? 'away' : 'home'
  const ourTeamName = ourSide === 'home' ? match.homeTeam : match.awayTeam
  const opponentName = ourSide === 'home' ? match.awayTeam : match.homeTeam
  const sideTeamName = (side: MatchSide) => (side === 'home' ? match.homeTeam : match.awayTeam)
  const goalTypeFor = (side: MatchSide) => (side === 'home' ? MatchEventType.GOAL_HOME : MatchEventType.GOAL_AWAY)

  const persistMatch = async (
    nextMatch: MatchRecord,
    successMessage: string,
    options: { syncLinked?: boolean; linkedOverrides?: Partial<MatchRecord> } = {},
  ) => {
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      if (linkedMatch && options.syncLinked !== false) {
        const linkedUpdates: Partial<MatchRecord> = {
          clock: nextMatch.clock,
          score: nextMatch.score,
          events: nextMatch.events,
          homeTeam: nextMatch.homeTeam,
          awayTeam: nextMatch.awayTeam,
          startsAt: nextMatch.startsAt,
          location: nextMatch.location,
          ...(nextMatch.clock.status === MatchStatus.FINISHED ? computeGoalStats(nextMatch.events, goalTypeFor(opponentSide)) : {}),
          ...options.linkedOverrides,
        }
        await updateMatches([
          { matchId: nextMatch.id, updates: nextMatch },
          { matchId: linkedMatch.id, updates: linkedUpdates },
        ])
      } else {
        await updateMatch(nextMatch.id, nextMatch)
      }
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

  const resetMatch = async () => {
    const nextMatch: MatchRecord = {
      ...match,
      clock: {
        status: MatchStatus.SCHEDULED,
        elapsedSeconds: 0,
        startedAt: null,
      },
      events: [],
      score: { home: 0, away: 0 },
      goalScorers: [],
      goalAssists: [],
      keeperNames: [],
    }

    setResetConfirm1Open(false)
    setResetConfirm2Open(false)
    await persistMatch(nextMatch, 'Kampen er resatt.', {
      linkedOverrides: { goalScorers: [], goalAssists: [], keeperNames: [] },
    })
  }

  const registerGoal = async (side: 'home' | 'away', scorerName: string, assistName?: string) => {
    const elapsedSeconds = getLiveElapsedSeconds(match.clock)
    const score = {
      home: side === 'home' ? match.score.home + 1 : match.score.home,
      away: side === 'away' ? match.score.away + 1 : match.score.away,
    }
    const teamName = sideTeamName(side)
    // Ved sammenkoblet kamp registreres målscorer også for motstanderlaget (som er et av våre egne lag)
    const tracksScorer = side === ourSide || Boolean(linkedMatch)
    const hasScorer = scorerName.trim().length > 0
    const eventType = goalTypeFor(side)
    const storedScorerName = tracksScorer && hasScorer ? scorerName.trim() : undefined
    const storedAssistName = tracksScorer && assistName ? assistName : undefined
    const text = buildGoalText(teamName, score, side === ourSide, storedScorerName, storedAssistName)
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

  const confirmAssist = (assistName?: string) => {
    setAssistModalOpen(false)
    if (editingGoalEvent) {
      void updateGoalEvent(editingGoalEvent, pendingScorer, assistName)
      setEditingGoalEvent(null)
    } else {
      void registerGoal(goalModalSide ?? ourSide, pendingScorer, assistName)
    }
    setGoalModalSide(null)
  }

  const openGoalRegistration = (side: MatchSide) => {
    if (side !== ourSide && !linkedMatch) {
      void registerGoal(side, 'Ukjent')
      return
    }
    const sideTeam = side === ourSide ? team : linkedTeam
    if (sideTeam?.requireScorerModal !== false) {
      setGoalModalSide(side)
      setScorerModalOpen(true)
    } else {
      void registerGoal(side, '')
    }
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

  const updateGoalEvent = async (event: MatchEvent, scorerName: string, assistName?: string) => {
    const side: MatchSide = event.type === MatchEventType.GOAL_HOME ? 'home' : 'away'
    const tracksScorer = side === ourSide || Boolean(linkedMatch)
    const hasScorer = scorerName.trim().length > 0
    const score = event.scoreAfter ?? match.score
    const storedScorerName = tracksScorer && hasScorer ? scorerName.trim() : undefined
    const storedAssistName = tracksScorer && assistName ? assistName : undefined
    const text = buildGoalText(sideTeamName(side), score, side === ourSide, storedScorerName, storedAssistName)
    const updatedEvent: MatchEvent = { ...event, text, scorerName: storedScorerName, assistName: storedAssistName, corrected: true }
    const nextEvents = match.events.map((e) => (e.id === event.id ? updatedEvent : e))
    const ourGoalType = ourSide === 'home' ? MatchEventType.GOAL_HOME : MatchEventType.GOAL_AWAY
    const { goalScorers, goalAssists } = computeGoalStats(nextEvents, ourGoalType)
    await persistMatch({ ...match, events: nextEvents, goalScorers, goalAssists }, 'Målhendelsen er oppdatert.')
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

  const updateInfoEvent = async () => {
    if (!editingInfoEvent || !editingInfoText.trim()) return
    const updatedEvent: MatchEvent = { ...editingInfoEvent, text: editingInfoText.trim() }
    const nextEvents = match.events.map((e) => (e.id === editingInfoEvent.id ? updatedEvent : e))
    await persistMatch({ ...match, events: nextEvents }, 'Kommentaren er oppdatert.')
    setEditingInfoEvent(null)
    setEditingInfoText('')
  }

  const handleMatchPhotoUpload = async (file: File) => {
    setPhotoUploading(true)
    setErrorMessage(null)
    try {
      await uploadMatchPhoto(matchId, file)
      setEditingPhoto(false)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Kunne ikke laste opp bildet.')
    } finally {
      setPhotoUploading(false)
    }
  }

  const handleDeleteMatchPhoto = async () => {
    setPhotoDeleting(true)
    setErrorMessage(null)
    try {
      await deleteMatchPhoto(matchId)
      setEditingPhoto(false)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Kunne ikke slette bildet.')
    } finally {
      setPhotoDeleting(false)
    }
  }

  const matchPlayerNames = match.playerNames ?? []
  const matchCoachNames = match.coachNames ?? []

  const canResetMatch = Boolean(
    profile &&
      (profile.roles.includes(UserRole.ADMIN) ||
        (profile.roles.includes(UserRole.TRENER) &&
          matchCoachNames.some((coach) => firstName(coach) === firstName(profile.parentName)))),
  )

  const isMatchedTeamCoach = Boolean(
    profile &&
      (profile.roles.includes(UserRole.ADMIN) ||
        (profile.roles.includes(UserRole.TRENER) &&
          (team?.coachNames ?? []).some((coach) => firstName(coach) === firstName(profile.parentName)))),
  )

  const isScorerVisible = (scorerTeam: TeamRecord | null | undefined) =>
    !(
      scorerTeam?.showScorerInEvents === false &&
      !(scorerTeam?.showScorerInEventsForCoach && isTrenerOrAdmin) &&
      !profile?.showScorerInEvents
    )

  const modalSide = goalModalSide ?? ourSide
  const modalTeamName = sideTeamName(modalSide)
  const modalPlayerNames = modalSide === ourSide ? matchPlayerNames : linkedMatch?.playerNames ?? []

  const handleSaveCoachNote = async () => {
    setCoachNoteSaving(true)
    setErrorMessage(null)
    setStatusMessage(null)
    try {
      await updateMatch(match.id, { coachNote: coachNoteValue.trim() })
      setEditingCoachNote(false)
      setStatusMessage('Trener-notatet er lagret.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Kunne ikke lagre trener-notatet.')
    } finally {
      setCoachNoteSaving(false)
    }
  }

  const handleRemoveMatchCoach = async (name: string) => {
    await persistMatch({ ...match, coachNames: matchCoachNames.filter((c) => c !== name) }, 'Trener fjernet fra kampen.', { syncLinked: false })
  }

  const handleAddMatchCoach = async (name: string) => {
    await persistMatch({ ...match, coachNames: [...matchCoachNames, name] }, 'Trener lagt til på kampen.', { syncLinked: false })
  }

  const handleRemoveMatchPlayer = async (name: string) => {
    await persistMatch({ ...match, playerNames: matchPlayerNames.filter((p) => p !== name) }, 'Spiller fjernet fra kampen.', { syncLinked: false })
  }

  const handleAddMatchPlayer = async (name: string) => {
    await persistMatch({ ...match, playerNames: [...matchPlayerNames, name] }, 'Spiller lagt til på kampen.', { syncLinked: false })
  }

  const toggleMatchKeeper = async (name: string) => {
    const keeperNames = match.keeperNames ?? []
    const nextKeeperNames = keeperNames.includes(name) ? keeperNames.filter((n) => n !== name) : [...keeperNames, name]
    await persistMatch({ ...match, keeperNames: nextKeeperNames }, 'Keeper-registrering oppdatert.', { syncLinked: false })
  }

  const coachSuggestions = (team?.coachNames ?? []).filter((name) => !matchCoachNames.includes(name))
  const playerSuggestions = (team?.playerNames ?? []).filter((name) => !matchPlayerNames.includes(name))
  const otherTeamPlayerGroups = allTeams
    .filter((otherTeam) => otherTeam.id !== match.teamId && !otherTeam.retired && otherTeam.allowPlayerLoans === true)
    .map((otherTeam) => ({
      label: `Fra ${otherTeam.name}`,
      names: (otherTeam.playerNames ?? []).filter((name) => !matchPlayerNames.includes(name)),
    }))
    .filter((group) => group.names.length > 0)
  const otherLoanPlayerNames = OTHER_LOAN_PLAYER_NAMES.filter(
    (name) => !matchPlayerNames.includes(name) && !(team?.playerNames ?? []).includes(name),
  )
  const playerGroups = [
    ...otherTeamPlayerGroups,
    ...(otherLoanPlayerNames.length > 0 ? [{ label: 'Andre lånespillere', names: otherLoanPlayerNames }] : []),
  ]

  const isScheduled = match.clock.status === MatchStatus.SCHEDULED
  const isFirstHalf = match.clock.status === MatchStatus.FIRST_HALF
  const isHalfTime = match.clock.status === MatchStatus.HALF_TIME
  const isFinished = match.clock.status === MatchStatus.FINISHED

  const showAttendanceInfo = !TEAMS_WITHOUT_ATTENDANCE_INFO.includes(team?.name ?? '')
  const loanedInPlayerNames =
    showAttendanceInfo && isFinished ? matchPlayerNames.filter((name) => !(team?.playerNames ?? []).includes(name)) : []
  const isPreMatch = isScheduled && Date.now() >= new Date(match.startsAt).getTime() - 30 * 60 * 1000
  const matchEndedEvent = match.events.find((e) => e.type === MatchEventType.MATCH_ENDED)
  const isWithin30MinAfterFinish = isFinished && matchEndedEvent
    ? Date.now() - new Date(matchEndedEvent.createdAt).getTime() < 60 * 60 * 1000
    : false
  const isOvertime =
    ((isFirstHalf || isHalfTime) && clockSeconds > halfDuration) ||
    clockSeconds > fullDuration

  return (
    <Stack spacing={3}>
      {(team || (canResetMatch && !isScheduled)) && (
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', my: -3 }}>
          {team ? (
            <Button
              component={RouterLink}
              to={`/teams/${team.id}`}
              startIcon={<ArrowBackRoundedIcon />}
            >
              {team.name}
            </Button>
          ) : (
            <span />
          )}
          {canResetMatch && !isScheduled && (
            <Button
              color="error"
              onClick={() => setResetConfirm1Open(true)}
            >
              Resett kamp
            </Button>
          )}
        </Stack>
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

            {(match.photoUrl || isTrenerOrAdmin) && (
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <PhotoCameraRoundedIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Lagbilde</Typography>
                  {isTrenerOrAdmin && (
                    <>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleMatchPhotoUpload(f); if (photoInputRef.current) photoInputRef.current.value = '' }}
                      />
                      <IconButton size="small" sx={{ ml: 'auto' }} onClick={() => match.photoUrl ? setEditingPhoto(true) : photoInputRef.current?.click()}>
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </>
                  )}
                </Stack>

                {match.photoUrl && (
                  <Box
                    component="img"
                    src={match.photoUrl}
                    alt="Lagbilde"
                    sx={{ width: '100%', maxWidth: 400, borderRadius: 2, objectFit: 'cover' }}
                  />
                )}
              </Stack>
            )}
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
              suggestionsLabel="Fra eget lag:"
              otherGroups={playerGroups}
              highlightGroups={[
                { names: match.keeperNames ?? [], label: 'Keeper', color: 'secondary' },
                ...(showAttendanceInfo ? [{ names: loanedInPlayerNames, label: 'Lånespillere', color: 'info' as const }] : []),
              ]}
              footerText={
                showAttendanceInfo && isFinished && playerSuggestions.length > 0
                  ? `Fravær: ${playerSuggestions.join(', ')}`
                  : undefined
              }
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
                    <Button variant="contained" startIcon={<PlayCircleRoundedIcon />} onClick={() => void startMatch()} sx={{ py: 1.9 }}>
                      Start kamp
                    </Button>
                  )}
                  {isFirstHalf && numberOfHalves === 2 && (
                    <Button variant="contained" color="warning" startIcon={<PauseCircleRoundedIcon />} onClick={() => void pauseMatch()} sx={{ py: 1.9 }}>
                      Pause
                    </Button>
                  )}
                  {isHalfTime && (
                    <Button variant="contained" color="secondary" startIcon={<FlagRoundedIcon />} onClick={() => void startSecondHalf()} sx={{ py: 1.9 }}>
                      Start 2. omgang
                    </Button>
                  )}
                  {!isFinished && !isScheduled && (
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<StopCircleRoundedIcon />}
                      onClick={() => { setEndMatchKeepers([]); setEndMatchNote(''); setEndMatchModalOpen(true) }}
                      sx={{ py: 1.9 }}
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
                        onClick={() => openGoalRegistration(ourSide)}
                        disabled={isFinished || isScheduled || isHalfTime}
                        sx={{ py: 2.3 }}
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
                        onClick={() => openGoalRegistration(opponentSide)}
                        disabled={isFinished || isScheduled || isHalfTime}
                        sx={{ py: 2.3 }}
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
                        onClick={() => openGoalRegistration(ourSide)}
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
                        onClick={() => openGoalRegistration(opponentSide)}
                      >
                        Mål {opponentName}
                      </Button>
                    </Grid>
                  </Grid>
                  {matchPlayerNames.length > 0 && (
                    <Stack spacing={1}>
                      <Typography variant="subtitle2">Hvem har vært keeper?</Typography>
                      {matchPlayerNames.map((player) => (
                        <FormControlLabel
                          key={player}
                          control={
                            <Checkbox
                              checked={(match.keeperNames ?? []).includes(player)}
                              onChange={() => void toggleMatchKeeper(player)}
                            />
                          }
                          label={player}
                        />
                      ))}
                    </Stack>
                  )}
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

      {isFinished && isMatchedTeamCoach && team?.showCoachNote !== false && (
        <Card>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Trener-notat</Typography>
              <Typography variant="body2" color="text.secondary">
                Kun synlig for trenere registrert på laget. Bruk gjerne til info om kampen eller motstanderlaget.
              </Typography>
              {editingCoachNote ? (
                <Stack spacing={1}>
                  <TextField
                    value={coachNoteValue}
                    onChange={(e) => setCoachNoteValue(e.target.value)}
                    disabled={coachNoteSaving}
                    multiline
                    minRows={3}
                    fullWidth
                    autoFocus
                    placeholder="F.eks. motstanderen presser høyt, husk å rotere keeper..."
                  />
                  <Stack direction="row" spacing={1}>
                    <Button onClick={() => void handleSaveCoachNote()} disabled={coachNoteSaving}>Lagre</Button>
                    <Button onClick={() => setEditingCoachNote(false)} disabled={coachNoteSaving}>Avbryt</Button>
                  </Stack>
                </Stack>
              ) : (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                  <Typography sx={{ whiteSpace: 'pre-wrap', flex: 1 }} color={match.coachNote ? 'text.primary' : 'text.secondary'}>
                    {match.coachNote || 'Ingen notater lagt til.'}
                  </Typography>
                  <IconButton size="small" onClick={() => { setCoachNoteValue(match.coachNote ?? ''); setEditingCoachNote(true) }}>
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {canManage && (isPreMatch || isFirstHalf || isHalfTime || match.clock.status === MatchStatus.SECOND_HALF || isWithin30MinAfterFinish || correctionMode) && (
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
                  const isOurGoal = event.type === (ourSide === 'home' ? MatchEventType.GOAL_HOME : MatchEventType.GOAL_AWAY)
                  const canEditGoal = canManage && correctionMode && isGoal && (isOurGoal || Boolean(linkedMatch))
                  const canEditInfo = canManage && correctionMode && isInfo
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
                    <ListItem key={event.id} divider disableGutters sx={{ pr: (canEditGoal || canEditInfo) ? 11 : canManage && (isGoal || isInfo) && (!isFinished || correctionMode) ? 6 : 0 }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>{eventIcon}</ListItemIcon>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                            <span>
                              {linkedMatch && isGoal
                                ? (() => {
                                    const goalSide: MatchSide = event.type === MatchEventType.GOAL_HOME ? 'home' : 'away'
                                    const showScorer = goalSide === ourSide ? isScorerVisible(team) : canSeeLinkedTeam && isScorerVisible(linkedTeam)
                                    return buildGoalText(
                                      sideTeamName(goalSide),
                                      event.scoreAfter ?? match.score,
                                      goalSide === ourSide,
                                      showScorer ? event.scorerName : undefined,
                                      showScorer ? event.assistName : undefined,
                                    )
                                  })()
                                : !isScorerVisible(team) &&
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
                          <Stack direction="row" spacing={0}>
                            {canEditGoal && (
                              <Tooltip title="Endre målscorer / assist">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => {
                                    setEditingGoalEvent(event)
                                    setGoalModalSide(event.type === MatchEventType.GOAL_HOME ? 'home' : 'away')
                                    setScorerModalOpen(true)
                                  }}
                                >
                                  <EditRoundedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {canEditInfo && (
                              <Tooltip title="Endre kommentar">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => {
                                    setEditingInfoEvent(event)
                                    setEditingInfoText(event.text)
                                  }}
                                >
                                  <EditRoundedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
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
                          </Stack>
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

      <Dialog open={resetConfirm1Open} onClose={() => setResetConfirm1Open(false)} fullWidth maxWidth="sm">
        <DialogTitle>Er du helt sikker?</DialogTitle>
        <DialogContent>
          <Typography>
            All data tilhørende kampen vil bli resatt. Alle hendelser slettes, keepere
            fjernes og tiden settes tilbake til 00:00.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setResetConfirm1Open(false)}>Avbryt</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => { setResetConfirm1Open(false); setResetConfirm2Open(true) }}
          >
            Ja, resett kampen
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={resetConfirm2Open} onClose={() => setResetConfirm2Open(false)} fullWidth maxWidth="sm">
        <DialogTitle>Er du HELT SIKKER?!</DialogTitle>
        <DialogContent>
          <Typography>
            Dette kan ikke angres. Alle hendelser tilhørende kampen slettes, registrering
            av keeper fjernes og tiden settes tilbake til 00:00.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setResetConfirm2Open(false)}>Avbryt</Button>
          <Button variant="contained" color="error" onClick={() => void resetMatch()}>
            Ja, jeg er helt sikker
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={scorerModalOpen} onClose={() => { setScorerModalOpen(false); setEditingGoalEvent(null); setGoalModalSide(null) }} fullWidth maxWidth="xs">
        <DialogTitle>{editingGoalEvent ? `Endre målscorer for ${modalTeamName}` : `Hvem scoret for ${modalTeamName}?`}</DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', pt: 1 }}>
            {modalPlayerNames.map((player) => (
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
            <Chip
              label="Selvmål"
              variant="outlined"
              color="warning"
              onClick={() => {
                setScorerModalOpen(false)
                setPendingScorer('Selvmål')
                setAssistModalOpen(true)
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => { setScorerModalOpen(false); setEditingGoalEvent(null); setGoalModalSide(null) }}>Avbryt</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={assistModalOpen} onClose={() => confirmAssist()} fullWidth maxWidth="xs">
        <DialogTitle>Hvem hadde assist?</DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', pt: 1 }}>
            {modalPlayerNames.filter((p) => p !== pendingScorer).map((player) => (
              <Chip
                key={player}
                label={player}
                onClick={() => confirmAssist(player)}
              />
            ))}
            <Chip
              label="Ingen assist"
              variant="outlined"
              onClick={() => confirmAssist()}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => confirmAssist()}>Hopp over</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(editingInfoEvent)} onClose={() => setEditingInfoEvent(null)} fullWidth maxWidth="sm">
        <DialogTitle>Endre kommentar</DialogTitle>
        <DialogContent>
          <TextField
            value={editingInfoText}
            onChange={(e) => setEditingInfoText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void updateInfoEvent()}
            fullWidth
            multiline
            rows={2}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setEditingInfoEvent(null)}>Avbryt</Button>
          <Button variant="contained" onClick={() => void updateInfoEvent()} disabled={!editingInfoText.trim()}>
            Lagre
          </Button>
        </DialogActions>
      </Dialog>

      <PhotoEditDialog
        open={editingPhoto}
        hasPhoto={Boolean(match.photoUrl)}
        uploading={photoUploading}
        deleting={photoDeleting}
        onClose={() => setEditingPhoto(false)}
        onUpload={(file) => { void handleMatchPhotoUpload(file) }}
        onDelete={() => { void handleDeleteMatchPhoto() }}
      />
    </Stack>
  )
}
