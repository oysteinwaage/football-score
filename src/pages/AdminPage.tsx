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
  IconButton,
  Stack,
  Switch,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { useCollection } from '../hooks/useRealtimeDatabase'
import { deleteUserProfile, updateUserAccess } from '../services/userService'
import { TeamRecord, UserProfile, UserRole } from '../types/domain'

export function AdminPage() {
  const { profile } = useAuth()
  const { data: users, loading: usersLoading, error: usersError } = useCollection<UserProfile>('users')
  const { data: teams, loading: teamsLoading, error: teamsError } = useCollection<TeamRecord>('teams')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [userPendingDeletion, setUserPendingDeletion] = useState<UserProfile | null>(null)
  const [deletingUser, setDeletingUser] = useState(false)

  const sortedUsers = useMemo(() => [...users].sort((left, right) => left.parentName.localeCompare(right.parentName)), [users])

  if (!profile?.roles.includes(UserRole.ADMIN)) {
    return <Alert severity="error">Denne siden er bare tilgjengelig for administratorer.</Alert>
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
