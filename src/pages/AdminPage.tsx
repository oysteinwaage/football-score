import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { useCollection } from '../hooks/useRealtimeDatabase'
import { deleteFeedback, markFeedbackRead } from '../services/feedbackService'
import { updateTeamAllowPlayerLoans, updateTeamHideHistoricalMatches, updateTeamRequireScorerModal, updateTeamShowCoachNote, updateTeamShowScorerInEvents, updateTeamShowScorerInEventsForCoach } from '../services/teamService'
import { deleteUserProfile, updateUserAccess, updateUserShowScorerInEvents } from '../services/userService'
import { FeedbackRecord, FeedbackType, TeamRecord, UserProfile, UserRole } from '../types/domain'

const feedbackTypeLabels: Record<FeedbackType, string> = {
  [FeedbackType.FEIL]: 'Feil / problem',
  [FeedbackType.FORSLAG]: 'Forbedringsforslag',
  [FeedbackType.ANNET]: 'Annet',
}

export function AdminPage() {
  const { profile } = useAuth()
  const { data: users, loading: usersLoading, error: usersError } = useCollection<UserProfile>('users')
  const { data: teams, loading: teamsLoading, error: teamsError } = useCollection<TeamRecord>('teams')
  const { data: feedbackList, loading: feedbackLoading, error: feedbackError } = useCollection<FeedbackRecord>('feedback')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [userPendingDeletion, setUserPendingDeletion] = useState<UserProfile | null>(null)
  const [deletingUser, setDeletingUser] = useState(false)
  const [expandedUserIds, setExpandedUserIds] = useState<Set<string>>(new Set())
  const [laginnstillingerExpanded, setLaginnstillingerExpanded] = useState(false)
  const [tilbakemeldingerExpanded, setTilbakemeldingerExpanded] = useState(false)
  const [feedbackPendingDeletion, setFeedbackPendingDeletion] = useState<FeedbackRecord | null>(null)

  const toggleExpanded = (userId: string) => {
    setExpandedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const sortedUsers = useMemo(() => [...users].sort((left, right) => left.parentName.localeCompare(right.parentName)), [users])

  const pendingUsers = useMemo(() => sortedUsers.filter((u) => !u.approved), [sortedUsers])
  const trenerUsers = useMemo(() => sortedUsers.filter((u) => u.approved && u.roles.includes(UserRole.TRENER)), [sortedUsers])
  const otherUsers = useMemo(() => sortedUsers.filter((u) => u.approved && !u.roles.includes(UserRole.TRENER)), [sortedUsers])

  const sortedFeedback = useMemo(
    () => [...feedbackList].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [feedbackList],
  )
  const unreadFeedbackCount = useMemo(() => sortedFeedback.filter((f) => !f.read).length, [sortedFeedback])

  if (!profile?.roles.includes(UserRole.ADMIN)) {
    return <Alert severity="error">Denne siden er bare tilgjengelig for administratorer.</Alert>
  }

  const toggleRole = async (user: UserProfile, role: UserRole) => {
    const isRemoving = user.roles.includes(role)
    if (isRemoving && role === UserRole.ADMIN) {
      const adminCount = users.filter((u) => u.roles.includes(UserRole.ADMIN)).length
      if (adminCount <= 1) return
    }

    const roles = isRemoving
      ? user.roles.filter((currentRole) => currentRole !== role)
      : [...user.roles, role]

    await updateUserAccess(user.id, {
      approved: user.approved,
      roles: roles.length > 0 ? roles : [UserRole.FORELDER],
      teamIds: user.teamIds,
    })
  }

  const toggleTeam = async (user: UserProfile, teamId: string) => {
    const teamIds = user.teamIds?.includes(teamId)
      ? user.teamIds.filter((currentTeamId) => currentTeamId !== teamId)
      : [...user.teamIds, teamId]

    await updateUserAccess(user.id, {
      approved: user.approved,
      roles: user.roles,
      teamIds,
    })
  }

  const toggleApproval = async (user: UserProfile) => {
    await updateUserAccess(user.id, {
      approved: !user.approved,
      roles: user.roles,
      teamIds: user.teamIds,
    })
  }

  const handleDeleteUser = async () => {
    if (!userPendingDeletion) {
      return
    }

    setDeletingUser(true)
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await deleteUserProfile(userPendingDeletion.id)
      setStatusMessage('Brukerprofilen ble slettet.')
      setUserPendingDeletion(null)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Kunne ikke slette brukeren.')
    } finally {
      setDeletingUser(false)
    }
  }

  const handleDeleteFeedback = async () => {
    if (!feedbackPendingDeletion) {
      return
    }

    try {
      await deleteFeedback(feedbackPendingDeletion.id)
      setFeedbackPendingDeletion(null)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Kunne ikke slette tilbakemeldingen.')
    }
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Administrasjon</Typography>
      {statusMessage && <Alert severity="success">{statusMessage}</Alert>}
      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
      {(usersError || teamsError || feedbackError) && <Alert severity="error">{usersError ?? teamsError ?? feedbackError}</Alert>}

      <Card>
        <Box
          onClick={() => setTilbakemeldingerExpanded((prev) => !prev)}
          sx={{ px: 2, py: 1.5, cursor: 'pointer', userSelect: 'none' }}
        >
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Typography variant="h5">Tilbakemeldinger</Typography>
              {unreadFeedbackCount > 0 && <Badge badgeContent={unreadFeedbackCount} color="error" />}
            </Stack>
            <ExpandMoreRoundedIcon
              sx={{ transform: tilbakemeldingerExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
            />
          </Stack>
        </Box>
        <Collapse in={tilbakemeldingerExpanded}>
          <Divider />
          <CardContent>
            <Stack spacing={2}>
              {feedbackLoading && <Alert severity="info">Laster tilbakemeldinger...</Alert>}
              {!feedbackLoading && sortedFeedback.length === 0 && (
                <Alert severity="info">Ingen tilbakemeldinger ennå.</Alert>
              )}
              {sortedFeedback.map((feedback, index, arr) => (
                <Box key={feedback.id}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'flex-start' }, justifyContent: 'space-between' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <Chip
                          label={feedbackTypeLabels[feedback.type]}
                          size="small"
                          color={feedback.type === FeedbackType.FEIL ? 'error' : 'primary'}
                          variant="outlined"
                        />
                        {!feedback.read && <Chip label="Ny" size="small" color="error" />}
                        <Typography variant="caption" color="text.secondary">
                          {feedback.userName} · {new Date(feedback.createdAt).toLocaleString('no-NO')}
                        </Typography>
                      </Stack>
                      <Typography sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>{feedback.message}</Typography>
                    </Box>
                    <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={feedback.read}
                            onChange={() => void markFeedbackRead(feedback.id, !feedback.read)}
                          />
                        }
                        label="Lest"
                        labelPlacement="start"
                      />
                      <IconButton
                        color="error"
                        aria-label="Slett tilbakemelding"
                        onClick={() => setFeedbackPendingDeletion(feedback)}
                      >
                        <DeleteOutlineRoundedIcon />
                      </IconButton>
                    </Stack>
                  </Stack>
                  {index < arr.length - 1 && <Divider sx={{ mt: 2 }} />}
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Collapse>
      </Card>

      <Card>
        <Box
          onClick={() => setLaginnstillingerExpanded((prev) => !prev)}
          sx={{ px: 2, py: 1.5, cursor: 'pointer', userSelect: 'none' }}
        >
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h5">Laginnstillinger</Typography>
            <ExpandMoreRoundedIcon
              sx={{ transform: laginnstillingerExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
            />
          </Stack>
        </Box>
        <Collapse in={laginnstillingerExpanded}>
          <Divider />
          <CardContent>
            <Stack spacing={2}>
              {teams.filter((t) => !t.retired).length === 0 && (
                <Alert severity="info">Ingen aktive lag.</Alert>
              )}
              {teams.filter((t) => !t.retired).map((team, index, arr) => (
                <Box key={team.id}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
                    <Typography sx={{ fontWeight: 700 }}>{team.name}</Typography>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={team.requireScorerModal !== false}
                            onChange={() => void updateTeamRequireScorerModal(team.id, team.requireScorerModal === false)}
                          />
                        }
                        label="Velg målscorer"
                        labelPlacement="start"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={team.showScorerInEvents !== false}
                            onChange={() => void updateTeamShowScorerInEvents(team.id, team.showScorerInEvents === false)}
                          />
                        }
                        label="Vis målscorer (alle)"
                        labelPlacement="start"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={team.showScorerInEventsForCoach === true}
                            onChange={() => void updateTeamShowScorerInEventsForCoach(team.id, team.showScorerInEventsForCoach !== true)}
                          />
                        }
                        label="Vis målscorer (trenere)"
                        labelPlacement="start"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={team.hideHistoricalMatches === true}
                            onChange={() => void updateTeamHideHistoricalMatches(team.id, team.hideHistoricalMatches !== true)}
                          />
                        }
                        label="Skjul historiske kamper"
                        labelPlacement="start"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={team.showCoachNote !== false}
                            onChange={() => void updateTeamShowCoachNote(team.id, team.showCoachNote === false)}
                          />
                        }
                        label="Vis trener-notat"
                        labelPlacement="start"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={team.allowPlayerLoans === true}
                            onChange={() => void updateTeamAllowPlayerLoans(team.id, team.allowPlayerLoans !== true)}
                          />
                        }
                        label="Spillere kan lånes bort til andre lag"
                        labelPlacement="start"
                      />
                    </Stack>
                  </Stack>
                  {index < arr.length - 1 && <Divider sx={{ mt: 2 }} />}
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Collapse>
      </Card>

      <Card
        component={RouterLink}
        to="/create-team"
        sx={{ textDecoration: 'none', color: 'inherit', display: 'block', '&:hover': { bgcolor: 'action.hover' } }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <AddRoundedIcon fontSize="small" color="primary" />
            <Typography variant="h5">Opprett nytt lag</Typography>
          </Stack>
        </Box>
      </Card>

      <Stack spacing={2}>
        <Typography variant="h5">Brukere og tilganger</Typography>
        {(usersLoading || teamsLoading) && <Alert severity="info">Laster brukere og lag...</Alert>}

        {(() => {
          const renderUserCard = (user: UserProfile) => {
            const isExpanded = expandedUserIds.has(user.id)
            return (
              <Card key={user.id}>
                <Box
                  onClick={() => toggleExpanded(user.id)}
                  sx={{ px: 2, py: 1.5, cursor: 'pointer', userSelect: 'none' }}
                >
                  <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flex: 1, minWidth: 0 }}>
                      <Avatar src={user.photoUrl} sx={{ width: 32, height: 32, fontSize: '0.875rem' }}>
                        {!user.photoUrl && user.parentName.charAt(0).toUpperCase()}
                      </Avatar>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, minWidth: 0 }}>
                      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'baseline' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{user.parentName}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>{user.childName}</Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                        {user.roles.map((role) => (
                          <Chip key={role} label={role} size="small" color="primary" variant="outlined" />
                        ))}
                      </Stack>
                      </Stack>
                    </Stack>
                    <ExpandMoreRoundedIcon
                      sx={{ flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                    />
                  </Stack>
                </Box>

                <Collapse in={isExpanded}>
                  <Divider />
                  <CardContent>
                    <Stack spacing={2}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between' }}>
                        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                          <Avatar src={user.photoUrl} sx={{ width: 48, height: 48 }}>
                            {!user.photoUrl && user.parentName.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="h6">{user.parentName}</Typography>
                            <Typography color="text.secondary">
                              Barn: {user.childName} · {user.email ?? 'Ingen e-post'}
                            </Typography>
                          </Box>
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
                          <FormControlLabel
                            control={<Switch checked={user.approved} onChange={() => void toggleApproval(user)} />}
                            label={user.approved ? 'Godkjent' : 'Ikke godkjent'}
                          />
                          <IconButton
                            color="error"
                            aria-label="Slett bruker"
                            disabled={user.id === profile.id}
                            onClick={() => setUserPendingDeletion(user)}
                          >
                            <DeleteOutlineRoundedIcon />
                          </IconButton>
                        </Stack>
                      </Stack>

                      <Box>
                        <Typography variant="subtitle2" gutterBottom>Roller</Typography>
                        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                          {(Object.values(UserRole) as UserRole[]).map((role) => (
                            <Chip
                              key={role}
                              label={role}
                              color={user.roles.includes(role) ? 'primary' : 'default'}
                              onClick={() => void toggleRole(user, role)}
                            />
                          ))}
                        </Stack>
                      </Box>

                      <Box>
                        <Typography variant="subtitle2" gutterBottom>Lagtilganger</Typography>
                        <Stack>
                          {teams.filter((t) => !t.retired).map((team) => (
                            <FormControlLabel
                              key={team.id}
                              control={<Checkbox checked={!!user.teamIds?.includes(team.id)} onChange={() => void toggleTeam(user, team.id)} />}
                              label={team.name}
                            />
                          ))}
                        </Stack>
                      </Box>

                      <Box>
                        <Typography variant="subtitle2" gutterBottom>Hendelsesvisning</Typography>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={user.showScorerInEvents ?? false}
                              onChange={() => void updateUserShowScorerInEvents(user.id, !(user.showScorerInEvents ?? false))}
                            />
                          }
                          label="Vis målscorer og assist i hendelser"
                        />
                      </Box>
                    </Stack>
                  </CardContent>
                </Collapse>
              </Card>
            )
          }

          return (
            <>
              {pendingUsers.length > 0 && (
                <Stack spacing={1.5}>
                  <Typography variant="h6" color="warning.main">Trenger godkjenning</Typography>
                  {pendingUsers.map(renderUserCard)}
                </Stack>
              )}

              <Stack spacing={1.5}>
                <Typography variant="h6">Trenere</Typography>
                {trenerUsers.length === 0
                  ? <Typography color="text.secondary" variant="body2">Ingen trenere registrert.</Typography>
                  : trenerUsers.map(renderUserCard)}
              </Stack>

              <Stack spacing={1.5}>
                <Typography variant="h6">Foreldre og andre</Typography>
                {otherUsers.length === 0
                  ? <Typography color="text.secondary" variant="body2">Ingen brukere her ennå.</Typography>
                  : otherUsers.map(renderUserCard)}
              </Stack>
            </>
          )
        })()}
      </Stack>

      <Dialog
        open={Boolean(userPendingDeletion)}
        onClose={() => !deletingUser && setUserPendingDeletion(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Slett bruker</DialogTitle>
        <DialogContent>
          <Typography>
            Er du helt sikker på at du vil slette brukerprofilen til
            {userPendingDeletion ? ` ${userPendingDeletion.parentName}` : ''}
            ?
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Dette sletter brukerprofilen fra databasen. Selve Firebase Authentication-kontoen slettes ikke fra klienten.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setUserPendingDeletion(null)} disabled={deletingUser}>
            Avbryt
          </Button>
          <Button color="error" variant="contained" onClick={() => void handleDeleteUser()} disabled={deletingUser}>
            {deletingUser ? 'Sletter...' : 'Bekreft sletting'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(feedbackPendingDeletion)}
        onClose={() => setFeedbackPendingDeletion(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Slett tilbakemelding</DialogTitle>
        <DialogContent>
          <Typography>Er du sikker på at du vil slette denne tilbakemeldingen?</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setFeedbackPendingDeletion(null)}>Avbryt</Button>
          <Button color="error" variant="contained" onClick={() => void handleDeleteFeedback()}>
            Bekreft sletting
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
