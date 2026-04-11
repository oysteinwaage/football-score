import {
  Alert,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { FormEvent, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { createTeam } from '../services/teamService'
import { TeamType, UserRole } from '../types/domain'

function splitLines(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function CreateTeamPage() {
  const { profile } = useAuth()
  const [teamName, setTeamName] = useState('')
  const [teamType, setTeamType] = useState<TeamType>(TeamType.SERIE)
  const [coachNames, setCoachNames] = useState('')
  const [playerNames, setPlayerNames] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!profile?.roles.includes(UserRole.ADMIN)) {
    return <Alert severity="error">Denne siden er bare tilgjengelig for administratorer.</Alert>
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await createTeam({
        name: teamName.trim(),
        teamType,
        coachNames: splitLines(coachNames),
        playerNames: splitLines(playerNames),
      })
      setTeamName('')
      setTeamType(TeamType.SERIE)
      setCoachNames('')
      setPlayerNames('')
      setStatusMessage('Laget ble opprettet.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Kunne ikke opprette laget.')
    }
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Opprett nytt lag</Typography>
      {statusMessage && <Alert severity="success">{statusMessage}</Alert>}
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
                  onChange={(e) => setTeamType(e.target.value as TeamType)}
                >
                  <MenuItem value={TeamType.SERIE}>Serie</MenuItem>
                  <MenuItem value={TeamType.CUP}>Cup</MenuItem>
                  <MenuItem value={TeamType.TEST}>Test</MenuItem>
                </Select>
              </FormControl>
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
