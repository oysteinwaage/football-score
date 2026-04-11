import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material'
import { useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { useCollection } from '../hooks/useRealtimeDatabase'
import { updateUserAccess } from '../services/userService'
import { TeamRecord, UserRole } from '../types/domain'

const roleLabels: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Admin',
  [UserRole.TRENER]: 'Trener',
  [UserRole.KAMPLEDER]: 'Kampleder',
  [UserRole.FORELDER]: 'Forelder',
}

export function ProfilePage() {
  const { profile } = useAuth()
  const { data: allTeams } = useCollection<TeamRecord>('teams')
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  if (!profile) return null

  const canEditTeams = profile.roles.includes(UserRole.ADMIN) || profile.roles.includes(UserRole.TRENER)
  const currentTeamIds = selectedTeamIds ?? profile.teamIds

  const toggleTeam = (teamId: string) => {
    setSaveSuccess(false)
    const base = selectedTeamIds ?? profile.teamIds
    setSelectedTeamIds(
      base.includes(teamId) ? base.filter((id) => id !== teamId) : [...base, teamId],
    )
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      await updateUserAccess(profile.id, {
        approved: profile.approved,
        roles: profile.roles,
        teamIds: currentTeamIds,
      })
      setSaveSuccess(true)
      setSelectedTeamIds(null)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Kunne ikke lagre endringene.')
    } finally {
      setSaving(false)
    }
  }

  const isDirty = selectedTeamIds !== null

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Min side</Typography>

      <Card>
        <CardContent>
          <Stack spacing={3}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
                <AccountCircleRoundedIcon fontSize="large" />
              </Avatar>
              <Box>
                <Typography variant="h6">{profile.parentName}</Typography>
                <Typography color="text.secondary">{profile.email ?? 'Ingen e-post'}</Typography>
              </Box>
            </Stack>

            <Divider />

            <Stack spacing={1}>
              <Typography variant="subtitle2" color="text.secondary">Barn</Typography>
              <Typography>{profile.childName}</Typography>
            </Stack>

            <Stack spacing={1}>
              <Typography variant="subtitle2" color="text.secondary">Roller</Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {profile.roles.map((role) => (
                  <Chip key={role} label={roleLabels[role]} size="small" color="primary" variant="outlined" />
                ))}
              </Stack>
            </Stack>

          </Stack>
        </CardContent>
      </Card>

      {canEditTeams && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Lagtilgang</Typography>
              <Typography variant="body2" color="text.secondary">
                Velg hvilke lag du skal ha tilgang til.
              </Typography>

              {allTeams.length === 0 ? (
                <Alert severity="info">Ingen lag funnet.</Alert>
              ) : (
                <Stack spacing={0.5}>
                  {allTeams.map((team) => (
                    <FormControlLabel
                      key={team.id}
                      control={
                        <Checkbox
                          checked={currentTeamIds.includes(team.id)}
                          onChange={() => toggleTeam(team.id)}
                          disabled={saving}
                        />
                      }
                      label={team.name}
                    />
                  ))}
                </Stack>
              )}

              {saveError && <Alert severity="error">{saveError}</Alert>}
              {saveSuccess && <Alert severity="success">Lagtilgang er oppdatert.</Alert>}

              <Button
                variant="contained"
                onClick={() => void handleSave()}
                disabled={!isDirty || saving}
                sx={{ alignSelf: 'flex-start' }}
              >
                {saving ? 'Lagrer...' : 'Lagre endringer'}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  )
}
