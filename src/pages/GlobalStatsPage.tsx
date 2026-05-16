import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded'
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded'
import SportsRoundedIcon from '@mui/icons-material/SportsRounded'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { useCollection } from '../hooks/useRealtimeDatabase'
import {
  MatchEventType,
  MatchRecord,
  MatchStatus,
  SongRecord,
  TeamRecord,
  TeamType,
  UserProfile,
  UserRole,
} from '../types/domain'

const EXCLUDED_MISSED_TEAM_ID = '-OpeKF308QIyvxBCz833'

const PLAYER_NAME_ALIASES: Record<string, string> = {
  'Thomas': 'Thomas W',
}

function normalizePlayerName(name: string): string {
  return PLAYER_NAME_ALIASES[name] ?? name
}

interface PlayerGlobalStats {
  name: string
  matchesPlayed: number
  matchesMissed: number
  matchesBorrowed: number
  goals: number
  assists: number
  keeperMatches: number
}

interface CoachGlobalStats {
  name: string
  matchesAttended: number
  matchesMissed: number
}

interface UserSongStats {
  id: string
  name: string
  totalPlays: number
}

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

export function GlobalStatsPage() {
  const { profile } = useAuth()
  const { data: allTeams } = useCollection<TeamRecord>('teams')
  const { data: allMatches } = useCollection<MatchRecord>('matches')
  const { data: allUsers } = useCollection<UserProfile>('users')
  const { data: allSongs } = useCollection<SongRecord>('songs')
  const [tab, setTab] = useState(0)

  const isAdmin = profile?.roles.includes(UserRole.ADMIN)

  const relevantTeams = useMemo(
    () => allTeams.filter((t) => t.teamType !== TeamType.TEST),
    [allTeams],
  )

  const relevantTeamIds = useMemo(() => new Set(relevantTeams.map((t) => t.id)), [relevantTeams])

  const finishedMatches = useMemo(
    () => allMatches.filter((m) => m.clock.status === MatchStatus.FINISHED && relevantTeamIds.has(m.teamId)),
    [allMatches, relevantTeamIds],
  )

  const teamMap = useMemo(() => {
    const map: Record<string, TeamRecord> = {}
    for (const team of relevantTeams) map[team.id] = team
    return map
  }, [relevantTeams])

  const matchesByTeam = useMemo(() => {
    const map: Record<string, MatchRecord[]> = {}
    for (const match of finishedMatches) {
      if (!map[match.teamId]) map[match.teamId] = []
      map[match.teamId].push(match)
    }
    return map
  }, [finishedMatches])

  const playerStats: PlayerGlobalStats[] = useMemo(() => {
    const statsMap: Record<string, PlayerGlobalStats> = {}

    const getOrCreate = (rawName: string): PlayerGlobalStats => {
      const name = normalizePlayerName(rawName)
      if (!statsMap[name]) {
        statsMap[name] = { name, matchesPlayed: 0, matchesMissed: 0, matchesBorrowed: 0, goals: 0, assists: 0, keeperMatches: 0 }
      }
      return statsMap[name]
    }

    for (const match of finishedMatches) {
      for (const rawName of match.playerNames ?? []) {
        getOrCreate(rawName).matchesPlayed++
      }
      for (const scorer of match.goalScorers ?? []) {
        getOrCreate(scorer.name).goals += scorer.goals
      }
      if (match.goalAssists && match.goalAssists.length > 0) {
        for (const assist of match.goalAssists) {
          getOrCreate(assist.name).assists += assist.assists
        }
      } else {
        for (const event of match.events ?? []) {
          if (
            (event.type === MatchEventType.GOAL_HOME || event.type === MatchEventType.GOAL_AWAY) &&
            event.assistName
          ) {
            getOrCreate(event.assistName).assists++
          }
        }
      }
      for (const rawName of match.keeperNames ?? []) {
        getOrCreate(rawName).keeperMatches++
      }

      const team = teamMap[match.teamId]
      if (team) {
        for (const rawName of match.playerNames ?? []) {
          const name = normalizePlayerName(rawName)
          const normalizedTeamNames = (team.playerNames ?? []).map(normalizePlayerName)
          if (!normalizedTeamNames.includes(name)) {
            statsMap[name].matchesBorrowed++
          }
        }
      }
    }

    for (const team of relevantTeams) {
      if (team.id === EXCLUDED_MISSED_TEAM_ID) continue
      const teamMatches = matchesByTeam[team.id] ?? []
      for (const match of teamMatches) {
        const presentNormalized = new Set((match.playerNames ?? []).map(normalizePlayerName))
        for (const rawName of team.playerNames ?? []) {
          const name = normalizePlayerName(rawName)
          if (statsMap[name] && !presentNormalized.has(name)) {
            statsMap[name].matchesMissed++
          }
        }
      }
    }

    return Object.values(statsMap)
      .filter((p) => p.matchesPlayed > 0)
      .sort((a, b) => b.matchesPlayed - a.matchesPlayed)
  }, [finishedMatches, relevantTeams, teamMap, matchesByTeam])

  const coachStats: CoachGlobalStats[] = useMemo(() => {
    const coachNames = new Set<string>()
    for (const team of relevantTeams) {
      for (const name of team.coachNames ?? []) coachNames.add(name)
    }

    const result: CoachGlobalStats[] = []

    for (const name of coachNames) {
      const matchesAttended = finishedMatches.filter((m) => (m.coachNames ?? []).includes(name)).length

      let matchesMissed = 0
      for (const team of relevantTeams) {
        if (!(team.coachNames ?? []).includes(name)) continue
        const teamMatches = matchesByTeam[team.id] ?? []
        for (const match of teamMatches) {
          if (!(match.coachNames ?? []).includes(name)) matchesMissed++
        }
      }

      result.push({ name, matchesAttended, matchesMissed })
    }

    return result
      .filter((c) => c.matchesAttended > 0 || c.matchesMissed > 0)
      .sort((a, b) => b.matchesAttended - a.matchesAttended)
  }, [finishedMatches, relevantTeams, matchesByTeam])

  const userSongStats: UserSongStats[] = useMemo(() => {
    const playsMap: Record<string, number> = {}

    for (const user of allUsers) {
      const teamPlays = Object.values(user.songPlays ?? {}).reduce((sum, v) => sum + v, 0)
      if (teamPlays > 0) playsMap[user.id] = (playsMap[user.id] ?? 0) + teamPlays
    }

    for (const song of allSongs) {
      for (const [userId, plays] of Object.entries(song.userPlays ?? {})) {
        if (plays > 0) playsMap[userId] = (playsMap[userId] ?? 0) + plays
      }
    }

    return Object.entries(playsMap)
      .map(([userId, totalPlays]) => {
        const user = allUsers.find((u) => u.id === userId || u.uid === userId)
        return {
          id: userId,
          name: user ? (user.parentName || user.displayName || user.childName || 'Ukjent') : 'Ukjent',
          totalPlays,
        }
      })
      .sort((a, b) => b.totalPlays - a.totalPlays)
  }, [allUsers, allSongs])

  if (!isAdmin) {
    return <Alert severity="error">Kun tilgjengelig for administratorer.</Alert>
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">Global statistikk</Typography>
        <Typography variant="body2" color="text.secondary">
          Alle lag og kamper samlet · {finishedMatches.length} avsluttede kamper
        </Typography>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v: number) => setTab(v)}>
          <Tab label="Spillere" icon={<SportsSoccerRoundedIcon fontSize="small" />} iconPosition="start" />
          <Tab label="Trenere" icon={<SportsRoundedIcon fontSize="small" />} iconPosition="start" />
          <Tab label="Sangavspillinger" icon={<MusicNoteRoundedIcon fontSize="small" />} iconPosition="start" />
        </Tabs>
      </Box>

      {tab === 0 && (
        <StatCard title="Spillerstatistikk – alle lag" icon={<GroupsRoundedIcon color="primary" />}>
          {playerStats.length === 0 ? (
            <Typography color="text.secondary" variant="body2">Ingen spillerdata tilgjengelig.</Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Spiller</TableCell>
                    <TableCell align="right" title="Kamper spilt">Spilt</TableCell>
                    <TableCell align="right" title="Kamper misset (på laget, ikke med)">Misset</TableCell>
                    <TableCell align="right" title="Kamper lånt til andre lag">Lånt ut</TableCell>
                    <TableCell align="right" title="Mål">Mål</TableCell>
                    <TableCell align="right" title="Assist">Assist</TableCell>
                    <TableCell align="right" title="Keepervakter">Keeper</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {playerStats.map((p, i) => (
                    <TableRow key={p.name}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          {i === 0 && <EmojiEventsRoundedIcon fontSize="small" color="warning" />}
                          <span>{p.name}</span>
                        </Stack>
                      </TableCell>
                      <TableCell align="right"><strong>{p.matchesPlayed}</strong></TableCell>
                      <TableCell align="right">
                        {p.matchesMissed > 0 ? (
                          <Chip label={p.matchesMissed} size="small" color="warning" variant="outlined" />
                        ) : '—'}
                      </TableCell>
                      <TableCell align="right">
                        {p.matchesBorrowed > 0 ? (
                          <Chip label={p.matchesBorrowed} size="small" color="info" variant="outlined" />
                        ) : '—'}
                      </TableCell>
                      <TableCell align="right">{p.goals > 0 ? p.goals : '—'}</TableCell>
                      <TableCell align="right">{p.assists > 0 ? p.assists : '—'}</TableCell>
                      <TableCell align="right">
                        {p.keeperMatches > 0 ? (
                          <Chip label={p.keeperMatches} size="small" color="secondary" variant="outlined" />
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </StatCard>
      )}

      {tab === 1 && (
        <StatCard title="Trenerstatistikk – alle lag" icon={<SportsRoundedIcon color="primary" />}>
          {coachStats.length === 0 ? (
            <Typography color="text.secondary" variant="body2">Ingen trenerdata tilgjengelig.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Trener</TableCell>
                  <TableCell align="right">Deltatt</TableCell>
                  <TableCell align="right">Misset</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {coachStats.map((c, i) => (
                  <TableRow key={c.name}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        {i === 0 && <EmojiEventsRoundedIcon fontSize="small" color="warning" />}
                        <span>{c.name}</span>
                      </Stack>
                    </TableCell>
                    <TableCell align="right"><strong>{c.matchesAttended}</strong></TableCell>
                    <TableCell align="right">
                      {c.matchesMissed > 0 ? (
                        <Chip label={c.matchesMissed} size="small" color="warning" variant="outlined" />
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </StatCard>
      )}

      {tab === 2 && (
        <StatCard title="Sangavspillinger per bruker – alle sanger" icon={<MusicNoteRoundedIcon color="primary" />}>
          {userSongStats.length === 0 ? (
            <Typography color="text.secondary" variant="body2">Ingen sangavspillinger registrert ennå.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Bruker</TableCell>
                  <TableCell align="right">Avspillinger totalt</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {userSongStats.map((u, i) => (
                  <TableRow key={u.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        {i === 0 && <EmojiEventsRoundedIcon fontSize="small" color="warning" />}
                        <span>{u.name}</span>
                      </Stack>
                    </TableCell>
                    <TableCell align="right"><strong>{u.totalPlays}</strong></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </StatCard>
      )}
    </Stack>
  )
}
