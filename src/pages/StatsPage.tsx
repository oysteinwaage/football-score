import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import SportsRoundedIcon from '@mui/icons-material/SportsRounded'
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { useCollection } from '../hooks/useRealtimeDatabase'
import { MatchRecord, MatchStatus, TeamRecord, UserRole } from '../types/domain'

function StatCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {icon}
            <Typography variant="h6">{title}</Typography>
          </Stack>
          {children}
        </Stack>
      </CardContent>
    </Card>
  )
}

export function StatsPage() {
  const { profile } = useAuth()
  const { data: allTeams } = useCollection<TeamRecord>('teams')
  const { data: allMatches } = useCollection<MatchRecord>('matches')
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')

  const canView = profile?.roles.some((r) => r === UserRole.ADMIN || r === UserRole.STATS)
  if (!canView) {
    return <Alert severity="error">Du har ikke tilgang til denne siden.</Alert>
  }

  const accessibleTeams = allTeams.filter((t) => !t.retired && (profile?.roles.includes(UserRole.ADMIN) || profile?.teamIds.includes(t.id)))

  const selectedTeam = accessibleTeams.find((t) => t.id === selectedTeamId) ?? null

  const finishedMatches = useMemo(
    () => allMatches.filter((m) => m.teamId === selectedTeamId && m.clock.status === MatchStatus.FINISHED),
    [allMatches, selectedTeamId],
  )

  const stats = useMemo(() => {
    if (!selectedTeam || finishedMatches.length === 0) return null

    let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0
    const goalScorerMap: Record<string, number> = {}
    const playerParticipation: Record<string, number> = {}
    const coachParticipation: Record<string, number> = {}
    const keeperAppearances: Record<string, number> = {}

    for (const match of finishedMatches) {
      const ourSide: 'home' | 'away' = selectedTeam.name === match.awayTeam ? 'away' : 'home'
      const theirSide: 'home' | 'away' = ourSide === 'home' ? 'away' : 'home'
      const ourScore = match.score[ourSide]
      const theirScore = match.score[theirSide]

      goalsFor += ourScore
      goalsAgainst += theirScore
      if (ourScore > theirScore) wins++
      else if (ourScore === theirScore) draws++
      else losses++

      for (const scorer of match.goalScorers ?? []) {
        goalScorerMap[scorer.name] = (goalScorerMap[scorer.name] ?? 0) + scorer.goals
      }

      for (const player of match.playerNames ?? []) {
        playerParticipation[player] = (playerParticipation[player] ?? 0) + 1
      }

      for (const coach of match.coachNames ?? []) {
        coachParticipation[coach] = (coachParticipation[coach] ?? 0) + 1
      }

      for (const keeper of match.keeperNames ?? []) {
        keeperAppearances[keeper] = (keeperAppearances[keeper] ?? 0) + 1
      }
    }

    const topScorers = Object.entries(goalScorerMap)
      .map(([name, goals]) => ({ name, goals }))
      .sort((a, b) => b.goals - a.goals)

    const playerList = Object.entries(playerParticipation)
      .map(([name, matches]) => ({ name, matches, keeperCount: keeperAppearances[name] ?? 0 }))
      .sort((a, b) => b.matches - a.matches)

    const coachList = Object.entries(coachParticipation)
      .map(([name, matches]) => ({ name, matches }))
      .sort((a, b) => b.matches - a.matches)

    return {
      totalMatches: finishedMatches.length,
      wins, draws, losses,
      goalsFor, goalsAgainst,
      goalDifference: goalsFor - goalsAgainst,
      topScorers,
      playerList,
      coachList,
    }
  }, [finishedMatches, selectedTeam])

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Statistikk</Typography>

      <FormControl fullWidth>
        <InputLabel>Velg lag</InputLabel>
        <Select
          label="Velg lag"
          value={selectedTeamId}
          onChange={(e) => setSelectedTeamId(e.target.value as string)}
        >
          {accessibleTeams.map((team) => (
            <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {selectedTeamId && !stats && (
        <Alert severity="info">Ingen avsluttede kamper for dette laget ennå.</Alert>
      )}

      {stats && (
        <Stack spacing={3}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" color="success.main">{stats.wins}</Typography>
                  <Typography variant="body2" color="text.secondary">Seire</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" color="text.secondary">{stats.draws}</Typography>
                  <Typography variant="body2" color="text.secondary">Uavgjort</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" color="error.main">{stats.losses}</Typography>
                  <Typography variant="body2" color="text.secondary">Tap</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" color={stats.goalDifference >= 0 ? 'success.main' : 'error.main'}>
                    {stats.goalDifference > 0 ? '+' : ''}{stats.goalDifference}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">Målforskjell</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {stats.totalMatches} avsluttede kamper · {stats.goalsFor} mål for · {stats.goalsAgainst} mål mot
            </Typography>
          </Box>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <StatCard title="Toppscorere" icon={<SportsSoccerRoundedIcon color="primary" />}>
                {stats.topScorers.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">Ingen registrerte mål.</Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>Spiller</TableCell>
                        <TableCell align="right">Mål</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.topScorers.map((s, i) => (
                        <TableRow key={s.name}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                              {i === 0 && <EmojiEventsRoundedIcon fontSize="small" color="warning" />}
                              <span>{s.name}</span>
                            </Stack>
                          </TableCell>
                          <TableCell align="right"><strong>{s.goals}</strong></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </StatCard>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <StatCard title="Spillerdeltakelse og keepervakter" icon={<GroupsRoundedIcon color="primary" />}>
                {stats.playerList.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">Ingen spillerdata registrert.</Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Spiller</TableCell>
                        <TableCell align="right">Kamper</TableCell>
                        <TableCell align="right">Keeper</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.playerList.map((p) => (
                        <TableRow key={p.name}>
                          <TableCell>{p.name}</TableCell>
                          <TableCell align="right">{p.matches}</TableCell>
                          <TableCell align="right">
                            {p.keeperCount > 0 ? (
                              <Chip label={p.keeperCount} size="small" color="secondary" variant="outlined" />
                            ) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </StatCard>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <StatCard title="Trenerdeltakelse" icon={<SportsRoundedIcon color="primary" />}>
                {stats.coachList.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">Ingen trenerdata registrert.</Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Trener</TableCell>
                        <TableCell align="right">Kamper</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.coachList.map((c) => (
                        <TableRow key={c.name}>
                          <TableCell>{c.name}</TableCell>
                          <TableCell align="right">{c.matches}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </StatCard>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <StatCard title="Kampresultater" icon={<BarChartRoundedIcon color="primary" />}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Motstander</TableCell>
                      <TableCell align="center">Resultat</TableCell>
                      <TableCell align="center">Utfall</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {finishedMatches
                      .slice()
                      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
                      .map((match) => {
                        const ourSide: 'home' | 'away' = selectedTeam!.name === match.awayTeam ? 'away' : 'home'
                        const theirSide: 'home' | 'away' = ourSide === 'home' ? 'away' : 'home'
                        const opponent = ourSide === 'home' ? match.awayTeam : match.homeTeam
                        const ourScore = match.score[ourSide]
                        const theirScore = match.score[theirSide]
                        const outcome = ourScore > theirScore ? 'Seier' : ourScore === theirScore ? 'Uavgjort' : 'Tap'
                        const color = ourScore > theirScore ? 'success' : ourScore === theirScore ? 'default' : 'error'
                        return (
                          <TableRow key={match.id}>
                            <TableCell>{opponent}</TableCell>
                            <TableCell align="center">{ourScore} - {theirScore}</TableCell>
                            <TableCell align="center">
                              <Chip label={outcome} size="small" color={color as 'success' | 'default' | 'error'} />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                  </TableBody>
                </Table>
              </StatCard>
            </Grid>
          </Grid>
        </Stack>
      )}
    </Stack>
  )
}
