import CheckBoxOutlineBlankRoundedIcon from '@mui/icons-material/CheckBoxOutlineBlankRounded'
import CheckBoxRoundedIcon from '@mui/icons-material/CheckBoxRounded'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { useCollection } from '../hooks/useRealtimeDatabase'
import { createTeam } from '../services/teamService'
import { updateUserAccess } from '../services/userService'
import { TeamType, UserProfile, UserRole } from '../types/domain'

function splitLines(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function firstName(name: string) {
  return name.split(' ')[0].toLowerCase()
}

export function CreateTeamPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { data: users } = useCollection<UserProfile>('users')
  const [teamName, setTeamName] = useState('')
  const [teamType, setTeamType] = useState<TeamType>(TeamType.SERIE)
  const [cupName, setCupName] = useState('')
  const [coachNames, setCoachNames] = useState('')
  const [playerNames, setPlayerNames] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.parentName.localeCompare(b.parentName)),
    [users],
  )

  useEffect(() => {
    const coachFirstNames = new Set(splitLines(coachNames).map((n) => firstName(n)))
    const playerNameSet = new Set(splitLines(playerNames).map((n) => n.toLowerCase()))

    const autoSelected = new Set<string>()
    for (const user of users) {
      if (user.roles.includes(UserRole.TRENER) && coachFirstNames.has(firstName(user.parentName))) {
        autoSelected.add(user.id)
      }
      if (user.childName) {
        const childParts = user.childName.toLowerCase().split(/\s+/).filter(Boolean)
        if (childParts.some((part) => playerNameSet.has(part))) {
          autoSelected.add(user.id)
        }
      }
    }

    setSelectedUserIds(autoSelected)
  }, [coachNames, playerNames, users])

  if (!profile?.roles.includes(UserRole.ADMIN)) {
    return <Alert severity="error">Denne siden er bare tilgjengelig for administratorer.</Alert>
  }

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const isAutoMatched = (user: UserProfile): boolean => {
    const coachFirstNames = new Set(splitLines(coachNames).map((n) => firstName(n)))
    const playerNameSet = new Set(splitLines(playerNames).map((n) => n.toLowerCase()))
    if (user.roles.includes(UserRole.TRENER) && coachFirstNames.has(firstName(user.parentName))) return true
    if (user.childName) {
      const childParts = user.childName.toLowerCase().split(/\s+/).filter(Boolean)
      if (childParts.some((part) => playerNameSet.has(part))) return true
    }
    return false
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)

    try {
      const team = await createTeam({
        name: teamName.trim(),
        teamType,
        cupName: teamType === TeamType.CUP ? cupName.trim() : undefined,
        coachNames: splitLines(coachNames),
        playerNames: splitLines(playerNames),
      })

      await Promise.all(
        Array.from(selectedUserIds).map((userId) => {
          const user = users.find((u) => u.id === userId)
          if (!user) return Promise.resolve()
          const teamIds = Array.from(new Set([...(user.teamIds ?? []), team.id]))
          return updateUserAccess(userId, { approved: user.approved, roles: user.roles, teamIds })
        }),
      )

      navigate(`/teams/${team.id}`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Kunne ikke opprette laget.')
    }
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Opprett nytt lag</Typography>
      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
      <Card sx={{ maxWidth: 560 }}>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField
                label="Lagnavn"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required
              />
              <FormControl size="small">
                <InputLabel>Lagtype</InputLabel>
                <Select
                  label="Lagtype"
                  value={teamType}
                  onChange={(e) => { setTeamType(e.target.value as TeamType); setCupName('') }}
                >
                  <MenuItem value={TeamType.SERIE}>Serie</MenuItem>
                  <MenuItem value={TeamType.CUP}>Cup</MenuItem>
                  <MenuItem value={TeamType.TEST}>Test</MenuItem>
                </Select>
              </FormControl>
              {teamType === TeamType.CUP && (
                <TextField
                  label="Navn på cup"
                  value={cupName}
                  onChange={(e) => setCupName(e.target.value)}
                  placeholder="f.eks. Norway Cup"
                  required
                />
              )}
              <TextField
                label="Trenere"
                value={coachNames}
                onChange={(e) => setCoachNames(e.target.value)}
                multiline
                minRows={4}
                helperText="Skriv ett navn per linje eller skil med komma."
              />
              <TextField
                label="Spillere"
                value={playerNames}
                onChange={(e) => setPlayerNames(e.target.value)}
                multiline
                minRows={6}
                helperText="Skriv ett navn per linje eller skil med komma."
              />

              {sortedUsers.length > 0 && (
                <Stack spacing={1}>
                  <Typography variant="subtitle2">
                    Brukertilganger
                    {selectedUserIds.size > 0 && (
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {selectedUserIds.size} valgt
                      </Typography>
                    )}
                  </Typography>
                  <Stack spacing={0.5}>
                    {sortedUsers.map((user) => {
                      const selected = selectedUserIds.has(user.id)
                      const autoMatch = isAutoMatched(user)
                      return (
                        <Box
                          key={user.id}
                          onClick={() => toggleUser(user.id)}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            px: 1.5,
                            py: 1,
                            borderRadius: 2,
                            cursor: 'pointer',
                            userSelect: 'none',
                            bgcolor: selected ? 'action.selected' : 'transparent',
                            '&:hover': { bgcolor: selected ? 'action.selected' : 'action.hover' },
                          }}
                        >
                          {selected
                            ? <CheckBoxRoundedIcon color="primary" fontSize="small" />
                            : <CheckBoxOutlineBlankRoundedIcon color="disabled" fontSize="small" />}
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{user.parentName}</Typography>
                            {user.childName && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                {user.childName}
                              </Typography>
                            )}
                          </Stack>
                          <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                            {autoMatch && (
                              <Chip label="auto" size="small" color="success" variant="outlined" />
                            )}
                            {user.roles.includes(UserRole.TRENER) && (
                              <Chip label={UserRole.TRENER} size="small" variant="outlined" />
                            )}
                          </Stack>
                        </Box>
                      )
                    })}
                  </Stack>
                </Stack>
              )}

              <Button type="submit" variant="contained" disabled={!teamName.trim()}>
                Opprett lag
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Stack>
  )
}
