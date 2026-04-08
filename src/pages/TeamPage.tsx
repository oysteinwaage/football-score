import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded'
import CloudDownloadRoundedIcon from '@mui/icons-material/CloudDownloadRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'

import { ManualMatchDialog, ManualMatchValues } from '../components/ManualMatchDialog'
import { useAuth } from '../context/AuthContext'
import { useCollection, useDocument } from '../hooks/useRealtimeDatabase'
import { fetchFotballCalendar } from '../services/fotballCalendar'
import { createMatch, deleteMatch, importFixtures } from '../services/matchService'
import { MatchRecord, MatchStatus, TeamRecord, UserRole } from '../types/domain'
import { getMatchOutcomeBackground, getMatchOutcomeForTeam } from '../utils/matchCardColors'

export function TeamPage() {
  const { teamId = '' } = useParams()
  const { profile } = useAuth()
  const { data: team, loading, error } = useDocument<TeamRecord>(teamId ? `teams/${teamId}` : null)
  const { data: matches, loading: matchesLoading } = useCollection<MatchRecord>('matches')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [calendarUrl, setCalendarUrl] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [matchPendingDeletion, setMatchPendingDeletion] = useState<MatchRecord | null>(null)
  const [deletingMatch, setDeletingMatch] = useState(false)

  const canManage = Boolean(profile?.roles.some((role) => role === UserRole.ADMIN || role === UserRole.KAMPLEDER))
  const isAdmin = Boolean(profile?.roles.includes(UserRole.ADMIN))
  const hasAccess = Boolean(profile && (isAdmin || profile.teamIds.includes(teamId)))

  const teamMatches = useMemo(
    () => matches.filter((match) => match.teamId === teamId).sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
    [matches, teamId],
  )

  if (loading) {
    return <Alert severity="info">Laster lag...</Alert>
  }

  if (error || !team) {
    return <Alert severity="error">Fant ikke laget.</Alert>
  }

  if (!hasAccess) {
    return <Alert severity="error">Du har ikke tilgang til dette laget.</Alert>
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
          <Typography variant="h4">{team.name}</Typography>
          <Typography color="text.secondary">
            {team.playerNames.length} spillere · {team.coachNames.length} trenere
          </Typography>
        </div>
        {canManage && (
          <Button variant="contained" startIcon={<AddCircleRoundedIcon />} onClick={() => setDialogOpen(true)}>
            Legg til kamp
          </Button>
        )}
      </Stack>

      {statusMessage && <Alert severity="success">{statusMessage}</Alert>}
      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Trenere</Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  {team.coachNames.map((coach) => <Chip key={coach} label={coach} />)}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Spillere</Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  {team.playerNames.map((player) => <Chip key={player} label={player} />)}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
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
            <Typography variant="h5">Kamper</Typography>
            {teamMatches.length === 0 ? (
              <Alert severity="info">Ingen kamper registrert ennå.</Alert>
            ) : (
              teamMatches.map((match) => (
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
                        <Typography sx={{ mt: 1, fontWeight: 700 }}>
                          {match.score.home} - {match.score.away}
                        </Typography>
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
