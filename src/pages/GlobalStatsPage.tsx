import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
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
  Collapse,
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
import { Fragment, useMemo, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { useCollection } from '../hooks/useRealtimeDatabase'
import type { MatchRecord, SongRecord, TeamRecord, UserProfile } from '../types/domain'
import { MatchEventType, MatchStatus, TeamType, UserRole } from '../types/domain'

const EXCLUDED_MISSED_TEAM_ID = '-OpeKF308QIyvxBCz833'

const PLAYER_NAME_ALIASES: Record<string, string> = {
  'Thomas': 'Thomas W',
}

function normalizePlayerName(name: string): string {
  return PLAYER_NAME_ALIASES[name] ?? name
}

interface PlayerTeamBreakdown {
  teamId: string
  teamName: string
  teamType: TeamType
  cupName?: string
  matchesPlayed: number
  matchesMissed: number
  isBorrowed: boolean
}

interface PlayerGlobalStats {
  name: string
  matchesPlayed: number
  matchesMissed: number
  matchesBorrowed: number
  goals: number
  assists: number
  keeperMatches: number
  teamBreakdown: PlayerTeamBreakdown[]
}

interface CoachTeamBreakdown {
  teamId: string
  teamName: string
  teamType: TeamType
  cupName?: string
  matchesAttended: number
  matchesMissed: number
}

interface CoachGlobalStats {
  name: string
  matchesAttended: number
  matchesMissed: number
  teamBreakdown: CoachTeamBreakdown[]
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
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)
  const [expandedCoach, setExpandedCoach] = useState<string | null>(null)

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
    const statsMap: Record<string, {
      name: string
      matchesPlayed: number
      matchesMissed: number
      matchesBorrowed: number
      goals: number
      assists: number
      keeperMatches: number
      officialTeams: Record<string, { played: number; missed: number }>
      borrowedTeams: Record<string, number>
    }> = {}

    const getOrCreate = (rawName: string) => {
      const name = normalizePlayerName(rawName)
      if (!statsMap[name]) {
        statsMap[name] = {
          name, matchesPlayed: 0, matchesMissed: 0, matchesBorrowed: 0,
          goals: 0, assists: 0, keeperMatches: 0,
          officialTeams: {}, borrowedTeams: {},
        }
      }
      return statsMap[name]
    }

    for (const match of finishedMatches) {
      const team = teamMap[match.teamId]
      const normalizedTeamNames = team
        ? new Set((team.playerNames ?? []).map(normalizePlayerName))
        : new Set<string>()

      for (const rawName of match.playerNames ?? []) {
        const stat = getOrCreate(rawName)
        const name = normalizePlayerName(rawName)
        stat.matchesPlayed++

        if (team) {
          if (normalizedTeamNames.has(name)) {
            if (!stat.officialTeams[match.teamId]) stat.officialTeams[match.teamId] = { played: 0, missed: 0 }
            stat.officialTeams[match.teamId].played++
          } else {
            stat.matchesBorrowed++
            stat.borrowedTeams[match.teamId] = (stat.borrowedTeams[match.teamId] ?? 0) + 1
          }
        }
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
            if (!statsMap[name].officialTeams[team.id]) {
              statsMap[name].officialTeams[team.id] = { played: 0, missed: 0 }
            }
            statsMap[name].officialTeams[team.id].missed++
          }
        }
      }
    }

    return Object.values(statsMap)
      .filter((p) => p.matchesPlayed > 0)
      .map((p): PlayerGlobalStats => ({
        name: p.name,
        matchesPlayed: p.matchesPlayed,
        matchesMissed: p.matchesMissed,
        matchesBorrowed: p.matchesBorrowed,
        goals: p.goals,
        assists: p.assists,
        keeperMatches: p.keeperMatches,
        teamBreakdown: [
          ...Object.entries(p.officialTeams).map(([teamId, counts]) => ({
            teamId,
            teamName: teamMap[teamId]?.name ?? 'Ukjent lag',
            teamType: teamMap[teamId]?.teamType ?? TeamType.SERIE,
            cupName: teamMap[teamId]?.cupName,
            matchesPlayed: counts.played,
            matchesMissed: counts.missed,
            isBorrowed: false,
          })),
          ...Object.entries(p.borrowedTeams).map(([teamId, count]) => ({
            teamId,
            teamName: teamMap[teamId]?.name ?? 'Ukjent lag',
            teamType: teamMap[teamId]?.teamType ?? TeamType.SERIE,
            cupName: teamMap[teamId]?.cupName,
            matchesPlayed: count,
            matchesMissed: 0,
            isBorrowed: true,
          })),
        ],
      }))
      .sort((a, b) => b.matchesPlayed - a.matchesPlayed)
  }, [finishedMatches, relevantTeams, teamMap, matchesByTeam])

  const coachStats: CoachGlobalStats[] = useMemo(() => {
    const coachNames = new Set<string>()
    for (const team of relevantTeams) {
      for (const name of team.coachNames ?? []) coachNames.add(name)
    }

    const result: CoachGlobalStats[] = []

    for (const name of coachNames) {
      let matchesAttended = 0
      let matchesMissed = 0
      const teamBreakdown: CoachTeamBreakdown[] = []

      for (const team of relevantTeams) {
        if (!(team.coachNames ?? []).includes(name)) continue
        const teamMatches = matchesByTeam[team.id] ?? []
        let teamAttended = 0
        let teamMissed = 0
        for (const match of teamMatches) {
          if ((match.coachNames ?? []).includes(name)) {
            teamAttended++
          } else {
            teamMissed++
          }
        }
        matchesAttended += teamAttended
        matchesMissed += teamMissed
        if (teamAttended > 0 || teamMissed > 0) {
          teamBreakdown.push({ teamId: team.id, teamName: team.name, teamType: team.teamType, cupName: team.cupName, matchesAttended: teamAttended, matchesMissed: teamMissed })
        }
      }

      result.push({ name, matchesAttended, matchesMissed, teamBreakdown })
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
                  {playerStats.map((p, i) => {
                    const isExpanded = expandedPlayer === p.name
                    const officialTeams = p.teamBreakdown.filter((t) => !t.isBorrowed)
                    const borrowedTeams = p.teamBreakdown.filter((t) => t.isBorrowed)
                    return (
                      <Fragment key={p.name}>
                        <TableRow
                          onClick={() => setExpandedPlayer(isExpanded ? null : p.name)}
                          sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                        >
                          <TableCell>{i + 1}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                {i === 0 && <EmojiEventsRoundedIcon fontSize="small" color="warning" />}
                                <span>{p.name}</span>
                              </Stack>
                              <ExpandMoreRoundedIcon
                                fontSize="small"
                                color="action"
                                sx={{
                                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                  transition: 'transform 0.2s',
                                }}
                              />
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
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            sx={{ py: 0, ...(isExpanded ? {} : { border: 0 }) }}
                          >
                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                              <Box sx={{ py: 2, px: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                                {officialTeams.length > 0 && (
                                  <Stack spacing={1} sx={{ mb: borrowedTeams.length > 0 ? 2 : 0 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                                      Egne lag
                                    </Typography>
                                    {officialTeams.map((t) => (
                                      <Stack key={t.teamId} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                        <Box sx={{ flex: 1 }}>
                                          <Typography variant="body2">{t.teamName}</Typography>
                                          {t.teamType === TeamType.CUP && t.cupName && (
                                            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>{t.cupName}</Typography>
                                          )}
                                        </Box>
                                        <Typography variant="body2" color="text.secondary">{t.matchesPlayed} spilt</Typography>
                                        {t.matchesMissed > 0 && (
                                          <Chip label={`${t.matchesMissed} misset`} size="small" color="warning" variant="outlined" />
                                        )}
                                      </Stack>
                                    ))}
                                  </Stack>
                                )}
                                {borrowedTeams.length > 0 && (
                                  <Stack spacing={1}>
                                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                                      Lånt til
                                    </Typography>
                                    {borrowedTeams.map((t) => (
                                      <Stack key={t.teamId} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                        <Box sx={{ flex: 1 }}>
                                          <Typography variant="body2">{t.teamName}</Typography>
                                          {t.teamType === TeamType.CUP && t.cupName && (
                                            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>{t.cupName}</Typography>
                                          )}
                                        </Box>
                                        <Chip
                                          label={`${t.matchesPlayed} kamp${t.matchesPlayed !== 1 ? 'er' : ''}`}
                                          size="small"
                                          color="info"
                                          variant="outlined"
                                        />
                                      </Stack>
                                    ))}
                                  </Stack>
                                )}
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    )
                  })}
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
                {coachStats.map((c, i) => {
                  const isExpanded = expandedCoach === c.name
                  return (
                    <Fragment key={c.name}>
                      <TableRow
                        onClick={() => setExpandedCoach(isExpanded ? null : c.name)}
                        sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                      >
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                              {i === 0 && <EmojiEventsRoundedIcon fontSize="small" color="warning" />}
                              <span>{c.name}</span>
                            </Stack>
                            <ExpandMoreRoundedIcon
                              fontSize="small"
                              color="action"
                              sx={{
                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s',
                              }}
                            />
                          </Stack>
                        </TableCell>
                        <TableCell align="right"><strong>{c.matchesAttended}</strong></TableCell>
                        <TableCell align="right">
                          {c.matchesMissed > 0 ? (
                            <Chip label={c.matchesMissed} size="small" color="warning" variant="outlined" />
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          sx={{ py: 0, ...(isExpanded ? {} : { border: 0 }) }}
                        >
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ py: 2, px: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                              <Stack spacing={1}>
                                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                                  Per lag
                                </Typography>
                                {c.teamBreakdown.map((t) => (
                                  <Stack key={t.teamId} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                    <Box sx={{ flex: 1 }}>
                                      <Typography variant="body2">{t.teamName}</Typography>
                                      {t.teamType === TeamType.CUP && t.cupName && (
                                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>{t.cupName}</Typography>
                                      )}
                                    </Box>
                                    <Typography variant="body2" color="text.secondary">{t.matchesAttended} deltatt</Typography>
                                    {t.matchesMissed > 0 && (
                                      <Chip label={`${t.matchesMissed} misset`} size="small" color="warning" variant="outlined" />
                                    )}
                                  </Stack>
                                ))}
                              </Stack>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  )
                })}
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
