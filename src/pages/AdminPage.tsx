import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
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
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { FormEvent, useMemo, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { useCollection } from '../hooks/useRealtimeDatabase'
import { createTeam } from '../services/teamService'
import { deleteUserProfile, updateUserAccess } from '../services/userService'
import { TeamRecord, UserProfile, UserRole } from '../types/domain'

function splitLines(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function AdminPage() {
  const { profile } = useAuth()
  const { data: users, loading: usersLoading, error: usersError } = useCollection<UserProfile>('users')
  const { data: teams, loading: teamsLoading, error: teamsError } = useCollection<TeamRecord>('teams')
  const [teamName, setTeamName] = useState('')
  const [coachNames, setCoachNames] = useState('')
  const [playerNames, setPlayerNames] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [userPendingDeletion, setUserPendingDeletion] = useState<UserProfile | null>(null)
  const [deletingUser, setDeletingUser] = useState(false)

  const sortedUsers = useMemo(() => [...users].sort((left, right) => left.parentName.localeCompare(right.parentName)), [users])

  if (!profile?.roles.includes(UserRole.ADMIN)) {
    return <Alert severity="error">Denne siden er bare tilgjengelig for administratorer.</Alert>
  }

  const handleCreateTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await createTeam({
        name: teamName.trim(),
        coachNames: splitLines(coachNames),
        playerNames: splitLines(playerNames),
      })
      setTeamName('')
      setCoachNames('')
      setPlayerNames('')
      setStatusMessage('Laget ble opprettet.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Kunne ikke opprette laget.')
    }
  }

  const toggleRole = async (user: UserProfile, role: UserRole) => {
    const roles = user.roles.includes(role)
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

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Administrasjon</Typography>
      {statusMessage && <Alert severity="success">{statusMessage}</Alert>}
      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
      {(usersError || teamsError) && <Alert severity="error">{usersError ?? teamsError}</Alert>}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card>
            <CardContent>
              <Stack component="form" spacing={2} onSubmit={handleCreateTeam}>
                <Typography variant="h5">Opprett nytt lag</Typography>
                <TextField label="Lagnavn" value={teamName} onChange={(event) => setTeamName(event.target.value)} required />
                <TextField
                  label="Trenere"
                  value={coachNames}
                  onChange={(event) => setCoachNames(event.target.value)}
                  multiline
                  minRows={4}
                  helperText="Skriv ett navn per linje eller skil med komma."
                />
                <TextField
                  label="Spillere"
                  value={playerNames}
                  onChange={(event) => setPlayerNames(event.target.value)}
                  multiline
                  minRows={6}
                  helperText="Skriv ett navn per linje eller skil med komma."
                />
                <Button type="submit" variant="contained" disabled={!teamName.trim()}>
                  Opprett lag
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <Stack spacing={2}>
            <Typography variant="h5">Brukere og tilganger</Typography>
            {(usersLoading || teamsLoading) && <Alert severity="info">Laster brukere og lag...</Alert>}
            {sortedUsers.map((user) => (
              <Card key={user.id}>
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="h6">{user.parentName}</Typography>
                        <Typography color="text.secondary">
                          Barn: {user.childName} · {user.email ?? 'Ingen e-post'}
                        </Typography>
                      </Box>
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
                      <Typography variant="subtitle2" gutterBottom>
                        Roller
                      </Typography>
                      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                        {Object.values(UserRole).map((role) => (
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
                      <Typography variant="subtitle2" gutterBottom>
                        Lagtilganger
                      </Typography>
                      <Stack>
                        {teams.map((team) => (
                          <FormControlLabel
                            key={team.id}
                            control={<Checkbox checked={!!user.teamIds?.includes(team.id)} onChange={() => void toggleTeam(user, team.id)} />}
                            label={team.name}
                          />
                        ))}
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Grid>
      </Grid>

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
    </Stack>
  )
}
