import {
  Alert,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { useCollection } from '../hooks/useRealtimeDatabase'
import { TeamRecord, TeamType, UserRole } from '../types/domain'

export function RetiredTeamsPage() {
  const { profile } = useAuth()
  const { data: teams, loading } = useCollection<TeamRecord>('teams')

  if (!profile?.roles.some((r) => r === UserRole.ADMIN || r === UserRole.TRENER)) {
    return <Alert severity="error">Denne siden er bare tilgjengelig for administratorer og trenere.</Alert>
  }

  const retiredTeams = teams.filter((team) => team.retired)

  const getTeamTitle = (team: TeamRecord) => {
    if (team.teamType === TeamType.CUP) {
      return `${team.cupName ?? 'Cup'} - ${team.name}`
    }
    return team.name
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Pensjonerte lag</Typography>
      {loading && <Alert severity="info">Laster lag...</Alert>}
      {!loading && retiredTeams.length === 0 && (
        <Alert severity="info">Ingen pensjonerte lag.</Alert>
      )}
      {retiredTeams.map((team) => (
        <Card
          key={team.id}
          component={RouterLink}
          to={`/teams/${team.id}`}
          sx={{ textDecoration: 'none', color: 'inherit', opacity: 0.8 }}
        >
          <CardContent>
            <Typography variant="h6">{getTeamTitle(team)}</Typography>
            <Typography color="text.secondary">
              {team.playerNames.length} spillere · {team.coachNames.length} trenere · {team.matchIds.length} kamper
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Stack>
  )
}
