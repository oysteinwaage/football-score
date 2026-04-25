import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { FormEvent, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { useCollection } from '../hooks/useRealtimeDatabase'
import { TeamRecord, TeamType } from '../types/domain'

export function OnboardingForm() {
  const { completeOnboarding, user } = useAuth()
  const { data: allTeams } = useCollection<TeamRecord>('teams')
  const teams = allTeams.filter((t) => !t.retired && t.teamType !== TeamType.TEST)
  const [parentName, setParentName] = useState(user?.displayName ?? '')
  const [childName, setChildName] = useState('')
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId],
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await completeOnboarding(parentName.trim(), childName.trim(), selectedTeamIds)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Kunne ikke lagre registreringen.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '70vh' }}>
      <Card sx={{ width: '100%', maxWidth: 560 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom>
            Fullfør første gangs registrering
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Før du kan få tilgang må vi vite hvem du er og hvilket barn du følger opp.
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <form onSubmit={handleSubmit}>
          <Stack spacing={2.5}>
            <TextField
              label="Ditt navn"
              value={parentName}
              onChange={(event) => setParentName(event.target.value)}
              required
            />
            <TextField
              label="Navn på barnet ditt"
              value={childName}
              onChange={(event) => setChildName(event.target.value)}
              required
            />
            {teams.length > 0 && (
              <Stack spacing={1}>
                <Typography variant="subtitle2">Hvilke lag ønsker du tilgang til?</Typography>
                {teams.map((team) => (
                  <FormControlLabel
                    key={team.id}
                    control={
                      <Checkbox
                        checked={selectedTeamIds.includes(team.id)}
                        onChange={() => toggleTeam(team.id)}
                      />
                    }
                    label={team.name}
                  />
                ))}
              </Stack>
            )}
            <Button
              type="submit"
              size="large"
              variant="contained"
              disabled={submitting || !parentName.trim() || !childName.trim()}
            >
              {submitting ? 'Lagrer...' : 'Send inn registrering'}
            </Button>
          </Stack>
          </form>
        </CardContent>
      </Card>
    </Box>
  )
}
