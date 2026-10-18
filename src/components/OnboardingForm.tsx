import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Divider,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { FormEvent, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { useCollection } from '../hooks/useRealtimeDatabase'
import { PlayerRecord, TeamRecord, TeamType } from '../types/domain'

function providerName(user: ReturnType<typeof useAuth>['user']): string {
  const id = user?.providerData?.[0]?.providerId ?? ''
  if (id === 'google.com') return 'Google'
  if (id.includes('microsoft')) return 'Microsoft'
  return 'innloggingsleverandøren din'
}

export function OnboardingForm() {
  const { completeOnboarding, user } = useAuth()
  const provider = providerName(user)
  const { data: allTeams } = useCollection<TeamRecord>('teams')
  const teams = allTeams.filter((t) => !t.retired && t.teamType !== TeamType.TEST)
  const [parentName, setParentName] = useState(user?.displayName ?? '')
  const { data: allPlayers } = useCollection<PlayerRecord>('players')
  const players = [...allPlayers].sort((a, b) => a.name.localeCompare(b.name, 'nb'))
  const [selectedPlayers, setSelectedPlayers] = useState<PlayerRecord[]>([])
  const [childName, setChildName] = useState('')
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const teamIdsForPlayers = (selected: PlayerRecord[]): string[] => {
    const names = new Set(selected.map((player) => player.name.trim().toLowerCase()))
    return teams
      .filter((team) => team.playerNames.some((name) => names.has(name.trim().toLowerCase())))
      .map((team) => team.id)
  }

  const handlePlayersChange = (nextPlayers: PlayerRecord[]) => {
    const previousTeamIds = teamIdsForPlayers(selectedPlayers)
    const nextTeamIds = teamIdsForPlayers(nextPlayers)
    setSelectedPlayers(nextPlayers)
    setSelectedTeamIds((prev) => {
      // Fjern lag som kun ble huket av for spillere som nå er fjernet, og legg til lagene til nye spillere.
      const kept = prev.filter((id) => !previousTeamIds.includes(id) || nextTeamIds.includes(id))
      return Array.from(new Set([...kept, ...nextTeamIds]))
    })
  }

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId],
    )
  }

  const resolvedChildName = selectedPlayers.length > 0
    ? selectedPlayers.map((player) => player.name).join(', ')
    : childName.trim()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await completeOnboarding(
        parentName.trim(),
        resolvedChildName,
        selectedTeamIds,
        selectedPlayers.map((player) => player.id),
      )
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
            {players.length > 0 && (
              <Autocomplete
                multiple
                options={players}
                value={selectedPlayers}
                onChange={(_, value) => handlePlayersChange(value)}
                getOptionLabel={(player) => player.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                noOptionsText="Fant ingen spiller med det navnet"
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Velg barnet ditt"
                    helperText="Har du flere barn på lagene, kan du velge alle."
                  />
                )}
              />
            )}
            {selectedPlayers.length === 0 && (
              <TextField
                label="Navn på barnet ditt"
                value={childName}
                onChange={(event) => setChildName(event.target.value)}
                helperText={players.length > 0 ? 'Finner du ikke barnet i listen over, skriv navnet her.' : undefined}
                required
              />
            )}
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
            <Divider />

            <Box>
              <Typography variant="subtitle2" gutterBottom>Data som lagres fra {provider}-kontoen din</Typography>
              <Stack spacing={0.5}>
                {[
                  'E-postadresse',
                  'Visningsnavn',
                  'Profilbilde',
                ].map((item) => (
                  <Typography key={item} variant="body2" color="text.secondary" sx={{ display: 'flex', gap: 1 }}>
                    <span>·</span><span>{item}</span>
                  </Typography>
                ))}
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                I tillegg lagres navn og informasjon du fyller inn i dette skjemaet. Ingen data deles med tredjepart.
              </Typography>
            </Box>

            <Button
              type="submit"
              size="large"
              variant="contained"
              disabled={submitting || !parentName.trim() || !resolvedChildName}
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
