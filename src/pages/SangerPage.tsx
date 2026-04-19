import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useRef, useState } from 'react'

import trulsFjes from '../assets/truls_fjes.png'

import { useAuth } from '../context/AuthContext'
import { useCollection } from '../hooks/useRealtimeDatabase'
import { addSong, deleteSong, incrementSongPlayCount } from '../services/songService'
import { incrementTeamSongPlayCount } from '../services/teamService'
import { incrementUserSongPlay } from '../services/userService'
import { SongRecord, TeamRecord, UserProfile, UserRole } from '../types/domain'

type PlayCountModalData = {
  title: string
  totalPlayCount: number
  entries: { id: string; name: string; plays: number }[]
}

function PlayCountModal({ data, onClose }: { data: PlayCountModalData; onClose: () => void }) {
  return (
    <Dialog open={true} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{data.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
            <Typography variant="h3" color="primary.main">{data.totalPlayCount}</Typography>
            <Typography color="text.secondary">totale avspillinger</Typography>
          </Stack>
          {data.entries.length === 0 ? (
            <Typography color="text.secondary" variant="body2">Ingen brukeravspillinger registrert ennå.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Bruker</TableCell>
                  <TableCell align="right">Avspillinger</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.entries.map((entry, i) => (
                  <TableRow key={entry.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        {i === 0 && <EmojiEventsRoundedIcon fontSize="small" color="warning" />}
                        <span>{entry.name}</span>
                      </Stack>
                    </TableCell>
                    <TableCell align="right"><strong>{entry.plays}</strong></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  )
}

function SongPlayer({
  title, url, playCount, onPlay, onDelete, onPlayCountClick, onAudioStart,
}: {
  title: string
  url: string
  playCount?: number
  onPlay?: () => void
  onDelete?: () => void
  onPlayCountClick?: () => void
  onAudioStart?: (el: HTMLAudioElement) => void
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <MusicNoteRoundedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>{title}</Typography>
            {playCount !== undefined && (
              <Typography
                variant="caption"
                color="text.secondary"
                onClick={onPlayCountClick}
                sx={onPlayCountClick ? { cursor: 'pointer' } : undefined}
              >
                {playCount} {playCount === 1 ? 'avspilling' : 'avspillinger'}
              </Typography>
            )}
            {onDelete && (
              <IconButton size="small" color="error" onClick={onDelete} aria-label="Slett sang">
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
          <Box
            component="audio"
            controls
            src={url}
            sx={{ width: '100%' }}
            onPlay={(e) => {
              const audio = e.currentTarget as HTMLAudioElement
              if (audio.currentTime < 1) onPlay?.()
              onAudioStart?.(audio)
            }}
          />
        </Stack>
      </CardContent>
    </Card>
  )
}

function AddSongDialog({ open, onClose, onAdd }: {
  open: boolean
  onClose: () => void
  onAdd: (title: string, url: string) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!title.trim() || !url.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onAdd(title, url)
      setTitle('')
      setUrl('')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke legge til sang.')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    if (saving) return
    setTitle('')
    setUrl('')
    setError(null)
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Legg til sang</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Tittel"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
            size="small"
            fullWidth
          />
          <TextField
            label="URL til lydfil fra suno.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd() }}
            disabled={saving}
            size="small"
            fullWidth
            placeholder="https://suno.com/song/... eller direkte .mp3-lenke"
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => void handleAdd()}
            disabled={saving || !title.trim() || !url.trim()}
          >
            {saving ? 'Legger til...' : 'Legg til sang'}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}

export function SangerPage() {
  const { profile } = useAuth()
  const { data: teams } = useCollection<TeamRecord>('teams')
  const { data: songs } = useCollection<SongRecord>('songs')
  const { data: users } = useCollection<UserProfile>('users')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [playCountModal, setPlayCountModal] = useState<PlayCountModalData | null>(null)
  const [spotifyVisible, setSpotifyVisible] = useState(false)
  const [eggVisible, setEggVisible] = useState(true)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  const handleAudioStart = (el: HTMLAudioElement) => {
    if (currentAudioRef.current && currentAudioRef.current !== el) {
      currentAudioRef.current.pause()
    }
    currentAudioRef.current = el
  }

  const canEdit = Boolean(profile?.roles.some((r) => r === UserRole.ADMIN || r === UserRole.TRENER || r === UserRole.KAMPLEDER))
  const canViewStats = Boolean(profile?.roles.some((r) => r === UserRole.TRENER || r === UserRole.ADMIN))

  const teamsWithSong = teams
    .filter((t) => t.songUrl && !t.retired)
    .sort((a, b) => (b.songPlayCount ?? 0) - (a.songPlayCount ?? 0))
  const sortedSongs = [...songs].sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0))

  const openTeamSongModal = (team: TeamRecord) => {
    const entries = users
      .filter((u) => (u.songPlays?.[team.id] ?? 0) > 0)
      .map((u) => ({
        id: u.id,
        name: u.parentName || u.displayName || u.childName || 'Ukjent',
        plays: u.songPlays![team.id],
      }))
      .sort((a, b) => b.plays - a.plays)
    setPlayCountModal({ title: team.songTitle || team.name, totalPlayCount: team.songPlayCount ?? 0, entries })
  }

  const openSongModal = (song: SongRecord) => {
    const entries = Object.entries(song.userPlays ?? {})
      .map(([userId, plays]) => {
        const user = users.find((u) => u.id === userId || u.uid === userId)
        return {
          id: userId,
          name: user ? (user.parentName || user.displayName || user.childName || 'Ukjent') : 'Ukjent',
          plays,
        }
      })
      .filter((e) => e.plays > 0)
      .sort((a, b) => b.plays - a.plays)
    setPlayCountModal({ title: song.title, totalPlayCount: song.playCount ?? 0, entries })
  }

  return (
    <Stack spacing={4}>
      <Typography variant="h4">Sanger</Typography>

      <Stack spacing={2}>
        <Typography variant="h5">Offisielle Lagsanger</Typography>
        {teamsWithSong.length === 0 ? (
          <Alert severity="info">Ingen lag har lagt til lagsang ennå.</Alert>
        ) : (
          teamsWithSong.map((team) => (
            <SongPlayer
              key={team.id}
              title={team.songTitle || team.name}
              url={team.songUrl!}
              playCount={team.songPlayCount ?? 0}
              onPlay={() => {
                void incrementTeamSongPlayCount(team.id)
                if (profile?.uid) void incrementUserSongPlay(profile.uid, team.id)
              }}
              onPlayCountClick={canViewStats ? () => openTeamSongModal(team) : undefined}
              onAudioStart={handleAudioStart}
            />
          ))
        )}
      </Stack>

      <Stack spacing={2}>
        <Typography variant="h5">Andre sanger</Typography>
        {sortedSongs.map((song) => (
          <SongPlayer
            key={song.id}
            title={song.title}
            url={song.url}
            playCount={song.playCount ?? 0}
            onPlay={() => void incrementSongPlayCount(song.id, profile?.uid)}
            onDelete={canEdit ? () => void deleteSong(song.id) : undefined}
            onPlayCountClick={canViewStats ? () => openSongModal(song) : undefined}
            onAudioStart={handleAudioStart}
          />
        ))}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 4 }}>
          <Button
            variant="outlined"
            startIcon={<AddRoundedIcon />}
            onClick={() => setAddDialogOpen(true)}
          >
            Legg til sang
          </Button>
          {profile?.roles.includes(UserRole.TRENER) && eggVisible && (
            <Box
              component="img"
              src={trulsFjes}
              onClick={() => {
                setSpotifyVisible(true)
                setEggVisible(false)
                setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 550)
              }}
              sx={{ cursor: 'pointer', userSelect: 'none', width: 40, height: 40, objectFit: 'contain', flexShrink: 0, borderRadius: '50%' }}
            />
          )}
        </Box>
      </Stack>

      {profile?.roles.includes(UserRole.TRENER) && spotifyVisible && (
        <Card variant="outlined" sx={{ overflow: 'hidden', borderRadius: 3 }}>
          <Box
            component="iframe"
            src="https://open.spotify.com/embed/track/0Ylc6W9EcUvRHaDgQ3VSli?utm_source=generator"
            width="100%"
            height={152}
            frameBorder={0}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            sx={{ display: 'block', border: 'none' }}
          />
        </Card>
      )}

      <AddSongDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdd={async (title, url) => { await addSong(title, url, profile?.uid) }}
      />

      {playCountModal && (
        <PlayCountModal data={playCountModal} onClose={() => setPlayCountModal(null)} />
      )}
    </Stack>
  )
}
