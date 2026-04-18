import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded'
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded'
import UnarchiveRoundedIcon from '@mui/icons-material/UnarchiveRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloudDownloadRoundedIcon from '@mui/icons-material/CloudDownloadRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'

import { ManualMatchDialog, ManualMatchValues } from '../components/ManualMatchDialog'
import { RosterCard } from '../components/RosterCard'
import { useAuth } from '../context/AuthContext'
import { useCollection, useDocument } from '../hooks/useRealtimeDatabase'
import { fetchFotballCalendar } from '../services/fotballCalendar'
import { createMatch, deleteMatch, importFixtures, updateMatch } from '../services/matchService'
import { deleteTeam, incrementTeamSongPlayCount, retireTeam, updateTeamHalfDuration, updateTeamName, updateTeamRoster, updateTeamSong } from '../services/teamService'
import { incrementUserSongPlay } from '../services/userService'
import { MatchEventType, MatchRecord, MatchStatus, TeamRecord, UserRole } from '../types/domain'
import { getMatchOutcomeBackground, getMatchOutcomeForTeam } from '../utils/matchCardColors'

export function TeamPage() {
  const { teamId = '' } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data: team, loading, error } = useDocument<TeamRecord>(teamId ? `teams/${teamId}` : null)
  const { data: matches, loading: matchesLoading } = useCollection<MatchRecord>('matches')
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [cupNameValue, setCupNameValue] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [editingSong, setEditingSong] = useState(false)
  const [songValue, setSongValue] = useState('')
  const [songTitleValue, setSongTitleValue] = useState('')
  const [songSaving, setSongSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [calendarUrl, setCalendarUrl] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [matchPendingDeletion, setMatchPendingDeletion] = useState<MatchRecord | null>(null)
  const [deletingMatch, setDeletingMatch] = useState(false)
  const [teamDeleteDialogOpen, setTeamDeleteDialogOpen] = useState(false)
  const [deletingTeam, setDeletingTeam] = useState(false)
  const [retiringTeam, setRetiringTeam] = useState(false)
  const [editingHalfDuration, setEditingHalfDuration] = useState(false)
  const [halfDurationValue, setHalfDurationValue] = useState('')
  const [halfDurationSaving, setHalfDurationSaving] = useState(false)

  const canManage = Boolean(profile?.roles.some((role) => role === UserRole.ADMIN || role === UserRole.KAMPLEDER || role === UserRole.TRENER))
  const canEditRoster = Boolean(profile?.roles.some((role) => role === UserRole.ADMIN || role === UserRole.TRENER))
  const isAdmin = Boolean(profile?.roles.includes(UserRole.ADMIN))
  const hasAccess = Boolean(profile && (isAdmin || profile.teamIds.includes(teamId)))

  const teamMatches = useMemo(
    () => matches.filter((match) => match.teamId === teamId).sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
    [matches, teamId],
  )

  const isTrenerOrAdmin = canEditRoster
  const visibleMatches = useMemo(() => {
    if (isTrenerOrAdmin) return teamMatches
    const now = Date.now()
    return teamMatches.filter((match) => {
      const pastGracePeriod = new Date(match.startsAt).getTime() + 2 * 60 * 60 * 1000 < now
      const hasMatchEndedEvent = match.events?.some((e) => e.type === MatchEventType.MATCH_ENDED) ?? false
      return !pastGracePeriod && !hasMatchEndedEvent
    })
  }, [teamMatches, isTrenerOrAdmin])

  if (loading) {
    return <Alert severity="info">Laster lag...</Alert>
  }

  if (error || !team) {
    return <Alert severity="error">Fant ikke laget.</Alert>
  }

  if (!hasAccess) {
    return <Alert severity="error">Du har ikke tilgang til dette laget.</Alert>
  }

  const handleSaveName = async () => {
    const trimmed = nameValue.trim()
    if (!trimmed) {
      setEditingName(false)
      return
    }
    setNameSaving(true)
    try {
      const isCup = team.teamType === 'CUP'
      await updateTeamName(teamId, trimmed, isCup ? cupNameValue.trim() || null : undefined)
      setEditingName(false)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Kunne ikke lagre lagnavnet.')
    } finally {
      setNameSaving(false)
    }
  }

  const normalizeSongUrl = (url: string): string => {
    const sunoMatch = url.match(/suno\.com\/song\/([a-f0-9-]+)/)
    if (sunoMatch) {
      return `https://cdn1.suno.ai/${sunoMatch[1]}.mp3`
    }
    return url
  }

  const handleSaveSong = async () => {
    const trimmed = normalizeSongUrl(songValue.trim())
    setSongSaving(true)
    try {
      await updateTeamSong(teamId, trimmed || null, songTitleValue.trim() || undefined)
      setEditingSong(false)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Kunne ikke lagre sanglenkен.')
    } finally {
      setSongSaving(false)
    }
  }

  const handleCreateMatch = async (values: ManualMatchValues) => {
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await createMatch({
        teamId,
        startsAt: new Date(values.startsAt).toISOString(),
        homeTeam: values.homeTeam.trim(),
        awayTeam: values.awayTeam.trim(),
        location: values.location.trim(),
      })
      setStatusMessage('Kampen ble lagt til.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Kunne ikke lagre kampen.')
    }
  }

  const handleImport = async () => {
    setImporting(true)
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      const fixtures = await fetchFotballCalendar(calendarUrl.trim())
      const createdCount = await importFixtures(
        teamId,
        fixtures,
        teamMatches.map((match) => match.externalSourceId ?? '').filter(Boolean),
      )
      setStatusMessage(`${createdCount} kamp(er) ble importert fra kalenderen.`)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? `${error.message} Hvis dette skyldes CORS må importen flyttes til en proxy/serverless-funksjon.`
          : 'Kunne ikke importere kalenderen.',
      )
    } finally {
      setImporting(false)
    }
  }

  const handleDeleteMatch = async () => {
    if (!matchPendingDeletion) {
      return
    }

    setDeletingMatch(true)
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await deleteMatch(matchPendingDeletion.id, teamId)
      setStatusMessage('Kampen ble slettet.')
      setMatchPendingDeletion(null)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Kunne ikke slette kampen.')
    } finally {
      setDeletingMatch(false)
    }
  }

  const handleRetireTeam = async (retired: boolean) => {
    setRetiringTeam(true)
    setErrorMessage(null)
    try {
      await retireTeam(teamId, retired)
      setStatusMessage(retired ? 'Laget er pensjonert.' : 'Laget er aktivert igjen.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Kunne ikke pensjonere laget.')
    } finally {
      setRetiringTeam(false)
    }
  }

  const handleSaveHalfDuration = async () => {
    const parsed = parseInt(halfDurationValue, 10)
    if (Number.isNaN(parsed) || parsed < 1) {
      return
    }
    setHalfDurationSaving(true)
    setErrorMessage(null)
    setStatusMessage(null)
    try {
      await updateTeamHalfDuration(teamId, parsed)
      setEditingHalfDuration(false)
      setStatusMessage('Omgangslengde lagret.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Kunne ikke lagre omgangslengden.')
    } finally {
      setHalfDurationSaving(false)
    }
  }

  const handleDeleteTeam = async () => {
    setDeletingTeam(true)
    setErrorMessage(null)
    try {
      await deleteTeam(teamId)
      navigate('/')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Kunne ikke slette laget.')
      setDeletingTeam(false)
      setTeamDeleteDialogOpen(false)
    }
  }

  const scheduledMatches = teamMatches.filter((m) => m.clock.status === MatchStatus.SCHEDULED)

  const handleRemoveCoach = async (name: string) => {
    await updateTeamRoster(teamId, team.playerNames, team.coachNames.filter((c) => c !== name))
    await Promise.all(
      scheduledMatches.map((m) => updateMatch(m.id, { coachNames: (m.coachNames ?? []).filter((c) => c !== name) })),
    )
  }

  const handleAddCoach = async (name: string) => {
    await updateTeamRoster(teamId, team.playerNames, [...team.coachNames, name])
    await Promise.all(
      scheduledMatches
        .filter((m) => !(m.coachNames ?? []).includes(name))
        .map((m) => updateMatch(m.id, { coachNames: [...(m.coachNames ?? []), name] })),
    )
  }

  const handleRemovePlayer = async (name: string) => {
    await updateTeamRoster(teamId, team.playerNames.filter((p) => p !== name), team.coachNames)
    await Promise.all(
      scheduledMatches.map((m) => updateMatch(m.id, { playerNames: (m.playerNames ?? []).filter((p) => p !== name) })),
    )
  }

  const handleAddPlayer = async (name: string) => {
    await updateTeamRoster(teamId, [...team.playerNames, name], team.coachNames)
    await Promise.all(
      scheduledMatches
        .filter((m) => !(m.playerNames ?? []).includes(name))
        .map((m) => updateMatch(m.id, { playerNames: [...(m.playerNames ?? []), name] })),
    )
  }

  const getFinishedMatchBackground = (match: MatchRecord) => {
    if (match.clock.status !== MatchStatus.FINISHED) {
      return 'background.paper'
    }

    return getMatchOutcomeBackground(getMatchOutcomeForTeam(match, team.name))
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between' }}>
        <div>
          {editingName ? (
            <Stack spacing={1}>
              <TextField
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSaveName()
                  if (e.key === 'Escape') setEditingName(false)
                }}
                disabled={nameSaving}
                autoFocus
                size="small"
                label="Lagnavn"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => void handleSaveName()} disabled={nameSaving}>
                          <CheckRoundedIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              {team.teamType === 'CUP' && (
                <TextField
                  value={cupNameValue}
                  onChange={(e) => setCupNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSaveName()
                    if (e.key === 'Escape') setEditingName(false)
                  }}
                  disabled={nameSaving}
                  size="small"
                  label="Navn på cup"
                  placeholder="f.eks. Norway Cup"
                />
              )}
            </Stack>
          ) : (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography variant="h4">{team.name}</Typography>
              {isAdmin && (
                <IconButton size="small" onClick={() => { setNameValue(team.name); setCupNameValue(team.cupName ?? ''); setEditingName(true) }}>
                  <EditRoundedIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
          )}
          {!editingName && team.teamType === 'CUP' && (
            <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
              {team.cupName || 'Mangler cup-navn'}
            </Typography>
          )}
          <Typography color="text.secondary">
            {team.playerNames.length} spillere · {team.coachNames.length} trenere
          </Typography>
        </div>
        <Stack direction="row" spacing={1}>
          {canManage && !team.retired && (
            <Button variant="contained" startIcon={<AddCircleRoundedIcon />} onClick={() => setDialogOpen(true)}>
              Legg til kamp
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="outlined"
              color="warning"
              startIcon={team.retired ? <UnarchiveRoundedIcon /> : <ArchiveRoundedIcon />}
              onClick={() => void handleRetireTeam(!team.retired)}
              disabled={retiringTeam}
            >
              {team.retired ? 'Aktiver lag' : 'Pensjonér lag'}
            </Button>
          )}
          {isAdmin && (
            <Button variant="outlined" color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => setTeamDeleteDialogOpen(true)}>
              Slett lag
            </Button>
          )}
        </Stack>
      </Stack>

      {statusMessage && <Alert severity="success">{statusMessage}</Alert>}
      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

      {team.songUrl && (
        <Card>
          <CardContent>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <MusicNoteRoundedIcon color="primary" fontSize="small" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{team.songTitle || 'Lagssang'}</Typography>
                {canEditRoster && (
                  <IconButton size="small" sx={{ ml: 'auto' }} onClick={() => { setSongValue(team.songUrl ?? ''); setSongTitleValue(team.songTitle ?? ''); setEditingSong(true) }}>
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>

              <Box
                component="audio"
                controls
                src={team.songUrl}
                sx={{ width: '100%' }}
                onPlay={() => {
                  void incrementTeamSongPlayCount(teamId)
                  if (profile?.uid) {
                    void incrementUserSongPlay(profile.uid, teamId)
                  }
                }}
              />
            </Stack>
          </CardContent>
        </Card>
      )}

      {canEditRoster && !team.songUrl && !editingSong && (
        <Button
          variant="text"
          startIcon={<MusicNoteRoundedIcon />}
          onClick={() => { setSongValue(''); setSongTitleValue(''); setEditingSong(true) }}
          sx={{ alignSelf: 'flex-start' }}
        >
          Legg til lagssang
        </Button>
      )}

      {editingSong && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Lagssang – lenke til lydfil</Typography>
              <TextField
                label="Sangtittel"
                value={songTitleValue}
                onChange={(e) => setSongTitleValue(e.target.value)}
                disabled={songSaving}
                fullWidth
                autoFocus
                placeholder="f.eks. Vår kampsang"
              />
              <TextField
                label="URL til lydfil"
                value={songValue}
                onChange={(e) => setSongValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleSaveSong()}
                disabled={songSaving}
                fullWidth
                placeholder="https://suno.com/song/... eller direkte .mp3-lenke"
              />
              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={() => void handleSaveSong()} disabled={songSaving}>
                  Lagre
                </Button>
                <Button onClick={() => setEditingSong(false)} disabled={songSaving}>
                  Avbryt
                </Button>
                {team.songUrl && (
                  <Button
                    color="error"
                    disabled={songSaving}
                    onClick={async () => {
                      setSongSaving(true)
                      try {
                        await updateTeamSong(teamId, null)
                        setEditingSong(false)
                      } catch (error) {
                        setErrorMessage(error instanceof Error ? error.message : 'Kunne ikke fjerne sangen.')
                      } finally {
                        setSongSaving(false)
                      }
                    }}
                  >
                    Fjern sang
                  </Button>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Omgangslengde</Typography>
              {editingHalfDuration ? (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <TextField
                    label="Minutter per omgang"
                    type="number"
                    value={halfDurationValue}
                    onChange={(e) => setHalfDurationValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSaveHalfDuration()
                      if (e.key === 'Escape') setEditingHalfDuration(false)
                    }}
                    disabled={halfDurationSaving}
                    size="small"
                    autoFocus
                    slotProps={{ htmlInput: { min: 1, max: 90 } }}
                  />
                  <Button onClick={() => void handleSaveHalfDuration()} disabled={halfDurationSaving}>Lagre</Button>
                  <Button onClick={() => setEditingHalfDuration(false)} disabled={halfDurationSaving}>Avbryt</Button>
                </Stack>
              ) : (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Typography>{team.halfDurationMinutes ?? 30} minutter per omgang</Typography>
                  {!team.retired && (
                    <IconButton size="small" onClick={() => { setHalfDurationValue(String(team.halfDurationMinutes ?? 30)); setEditingHalfDuration(true) }}>
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <RosterCard
            title="Trenere"
            names={team.coachNames}
            canEdit={canEditRoster && !team.retired}
            onRemove={handleRemoveCoach}
            onAdd={handleAddCoach}
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <RosterCard
            title="Spillere"
            names={team.playerNames}
            canEdit={canEditRoster && !team.retired}
            onRemove={handleRemovePlayer}
            onAdd={handleAddPlayer}
          />
        </Grid>
        {isAdmin &&
            <Grid size={{ xs: 12, lg: 4 }}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Kalenderimport fra fotball.no</Typography>
                <Typography color="text.secondary">
                  Lim inn en kalenderlenke for å opprette kamper automatisk på laget.
                </Typography>
                <TextField
                  label="Kalender-URL"
                  value={calendarUrl}
                  onChange={(event) => setCalendarUrl(event.target.value)}
                  fullWidth
                />
                <Button variant="outlined" startIcon={<CloudDownloadRoundedIcon />} onClick={() => void handleImport()} disabled={importing || !calendarUrl.trim() || matchesLoading}>
                  {importing ? 'Importerer...' : 'Importer kamper'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        }
      </Grid>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5">{isTrenerOrAdmin ? 'Kamper' : 'Kommende kamper'}</Typography>
            {visibleMatches.length === 0 ? (
              <Alert severity="info">{isTrenerOrAdmin ? 'Ingen kamper registrert ennå.' : 'Ingen kommende kamper.'}</Alert>
            ) : (
              visibleMatches.map((match) => (
                <Card
                  key={match.id}
                  variant="outlined"
                  sx={{
                    bgcolor: getFinishedMatchBackground(match),
                  }}
                >
                  <CardContent>
                    <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Stack
                        component={RouterLink}
                        to={`/matches/${match.id}`}
                        spacing={0.5}
                        sx={{ textDecoration: 'none', color: 'inherit', flex: 1, minWidth: 0 }}
                      >
                        <Typography variant="h6">{match.homeTeam} - {match.awayTeam}</Typography>
                        <Typography color="text.secondary">
                          {new Date(match.startsAt).toLocaleString('nb-NO')} · {match.location || 'Sted ikke satt'}
                        </Typography>
                        {match.clock.status !== MatchStatus.SCHEDULED && (
                          <Typography sx={{ mt: 1, fontWeight: 700 }}>
                            {match.score.home} - {match.score.away}
                          </Typography>
                        )}
                      </Stack>
                      {isAdmin && (
                        <IconButton
                          color="error"
                          aria-label="Slett kamp"
                          onClick={() => setMatchPendingDeletion(match)}
                        >
                          <DeleteOutlineRoundedIcon />
                        </IconButton>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ))
            )}
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={teamDeleteDialogOpen} onClose={() => !deletingTeam && setTeamDeleteDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Slett lag</DialogTitle>
        <DialogContent>
          <Typography>
            Er du helt sikker på at du vil slette <strong>{team.name}</strong>? Dette vil også slette alle tilhørende kamper og fjerne laget fra alle brukere.
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Denne handlingen kan ikke angres.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setTeamDeleteDialogOpen(false)} disabled={deletingTeam}>
            Avbryt
          </Button>
          <Button color="error" variant="contained" onClick={() => void handleDeleteTeam()} disabled={deletingTeam}>
            {deletingTeam ? 'Sletter...' : 'Bekreft sletting'}
          </Button>
        </DialogActions>
      </Dialog>
      <ManualMatchDialog open={dialogOpen} teamName={team.name} onClose={() => setDialogOpen(false)} onSubmit={handleCreateMatch} />
      <Dialog
        open={Boolean(matchPendingDeletion)}
        onClose={() => !deletingMatch && setMatchPendingDeletion(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Slett kamp</DialogTitle>
        <DialogContent>
          <Typography>
            Er du helt sikker på at du vil slette kampen
            {matchPendingDeletion ? ` ${matchPendingDeletion.homeTeam} - ${matchPendingDeletion.awayTeam}` : ''}
            ?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setMatchPendingDeletion(null)} disabled={deletingMatch}>
            Avbryt
          </Button>
          <Button color="error" variant="contained" onClick={() => void handleDeleteMatch()} disabled={deletingMatch}>
            {deletingMatch ? 'Sletter...' : 'Bekreft sletting'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
