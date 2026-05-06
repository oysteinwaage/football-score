import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded'
import SkipPreviousRoundedIcon from '@mui/icons-material/SkipPreviousRounded'
import {
  Alert,
  Box,
  Button,
  Card,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { keyframes } from '@mui/system'
import { useEffect, useRef, useState } from 'react'

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

type ActiveItem = { type: 'official' | 'other'; index: number } | null

const eqBar = [
  keyframes`0%,100%{height:3px}50%{height:15px}`,
  keyframes`0%,100%{height:12px}40%{height:3px}70%{height:15px}`,
  keyframes`0%,100%{height:6px}30%{height:15px}65%{height:3px}`,
]

function EqualizerBars({ playing }: { playing: boolean }) {
  const staticHeights = [4, 11, 6]
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '2.5px', height: 20, width: 20, justifyContent: 'center', pb: '2px' }}>
      {eqBar.map((anim, i) => (
        <Box
          key={i}
          sx={{
            width: 3,
            borderRadius: '2px',
            bgcolor: 'primary.main',
            height: playing ? 3 : staticHeights[i],
            animation: playing ? `${anim} ${0.65 + i * 0.12}s ease-in-out infinite` : 'none',
            transition: 'height 0.25s ease',
          }}
        />
      ))}
    </Box>
  )
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

function PlaylistRow({
  title,
  url,
  playCount,
  addedByName,
  isActive,
  onActivate,
  onStarted,
  onEnded,
  onDelete,
  onPlayCountClick,
  nextTitle,
  onPrev,
  onNext,
}: {
  title: string
  url: string
  playCount?: number
  addedByName?: string
  isActive: boolean
  onActivate: () => void
  onStarted?: () => void
  onEnded?: () => void
  onDelete?: () => void
  onPlayCountClick?: () => void
  nextTitle?: string
  onPrev?: () => void
  onNext?: () => void
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [audioPlaying, setAudioPlaying] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isActive) {
      void audio.play()
    } else {
      audio.pause()
    }
  }, [isActive])

  const handlePlayPauseClick = () => {
    if (!isActive) {
      onActivate()
      return
    }
    const audio = audioRef.current
    if (!audio) return
    if (audioPlaying) {
      audio.pause()
    } else {
      void audio.play()
    }
  }

  return (
    <Box sx={{ bgcolor: isActive ? 'action.hover' : 'transparent', transition: 'background-color 0.35s ease' }}>
      <Stack direction="row" sx={{ alignItems: 'center', px: 2, py: 1.5, gap: 1 }}>
        {!isActive && (
          <IconButton
            size="small"
            onClick={handlePlayPauseClick}
            color="primary"
            sx={{
              flexShrink: 0,
              transition: 'transform 0.15s ease',
              '&:hover': { transform: 'scale(1.2)' },
            }}
          >
            <PlayArrowRoundedIcon />
          </IconButton>
        )}
        {isActive && (
          <Box sx={{ flexShrink: 0, p: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30 }}>
            <EqualizerBars playing={audioPlaying} />
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body1"
            sx={{
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'primary.main' : 'text.primary',
              transition: 'color 0.35s ease',
            }}
          >
            {title}
          </Typography>
          {addedByName && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {addedByName}
            </Typography>
          )}
        </Box>
        {playCount !== undefined && (
          <Typography
            variant="caption"
            color="text.secondary"
            onClick={onPlayCountClick}
            sx={onPlayCountClick ? { cursor: 'pointer', userSelect: 'none' } : undefined}
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
      <Collapse in={isActive} unmountOnExit={false}>
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
            <IconButton size="small" onClick={onPrev} disabled={!onPrev} sx={{ flexShrink: 0 }}>
              <SkipPreviousRoundedIcon />
            </IconButton>
            <Box
              component="audio"
              ref={audioRef}
              controls
              src={url}
              preload="none"
              sx={{ flex: 1, minWidth: 0 }}
              onPlay={() => {
                setAudioPlaying(true)
                const audio = audioRef.current
                if (audio && audio.currentTime < 1) onStarted?.()
              }}
              onPause={() => setAudioPlaying(false)}
              onEnded={() => {
                setAudioPlaying(false)
                if (audioRef.current) audioRef.current.currentTime = 0
                onEnded?.()
              }}
            />
            <IconButton size="small" onClick={onNext} disabled={!onNext} sx={{ flexShrink: 0 }}>
              <SkipNextRoundedIcon />
            </IconButton>
          </Stack>
          {nextTitle && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Neste sang: {nextTitle}
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
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
  const [activeItem, setActiveItem] = useState<ActiveItem>(null)
  const [deleteConfirmSong, setDeleteConfirmSong] = useState<SongRecord | null>(null)

  const canEdit = Boolean(profile?.roles.some((r) => r === UserRole.ADMIN || r === UserRole.TRENER || r === UserRole.KAMPLEDER))
  const canViewStats = Boolean(profile?.roles.some((r) => r === UserRole.TRENER || r === UserRole.ADMIN))

  const resolveUserName = (uid?: string) => {
    if (!uid) return undefined
    const u = users.find((u) => u.id === uid || u.uid === uid)
    return u ? (u.parentName || u.displayName || u.childName || undefined) : undefined
  }

  const teamsWithSong = teams
    .filter((t) => t.songUrl && !t.retired)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const sortedSongs = [...songs].sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const playNext = (type: 'official' | 'other', index: number) => {
    if (type === 'official') {
      if (index < teamsWithSong.length - 1) {
        setActiveItem({ type: 'official', index: index + 1 })
      } else if (sortedSongs.length > 0) {
        setActiveItem({ type: 'other', index: 0 })
      } else {
        setActiveItem(null)
      }
    } else {
      if (index < sortedSongs.length - 1) {
        setActiveItem({ type: 'other', index: index + 1 })
      } else {
        setActiveItem(null)
      }
    }
  }

  const playPrev = (type: 'official' | 'other', index: number) => {
    if (type === 'official') {
      if (index > 0) setActiveItem({ type: 'official', index: index - 1 })
    } else {
      if (index > 0) {
        setActiveItem({ type: 'other', index: index - 1 })
      } else if (teamsWithSong.length > 0) {
        setActiveItem({ type: 'official', index: teamsWithSong.length - 1 })
      }
    }
  }

  const getNextTitle = (type: 'official' | 'other', index: number): string | undefined => {
    if (type === 'official') {
      if (index + 1 < teamsWithSong.length) return teamsWithSong[index + 1].songTitle || teamsWithSong[index + 1].name
      if (sortedSongs.length > 0) return sortedSongs[0].title
      return undefined
    }
    return index + 1 < sortedSongs.length ? sortedSongs[index + 1].title : undefined
  }


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
        <Typography variant="h5">Offisielle Lagsanger ⚽️</Typography>
        {teamsWithSong.length === 0 ? (
          <Alert severity="info">Ingen lag har lagt til lagsang ennå.</Alert>
        ) : (
          <Paper variant="outlined">
            {teamsWithSong.map((team, index) => (
              <Box key={team.id}>
                {index > 0 && <Divider />}
                <PlaylistRow
                  title={team.songTitle || team.name}
                  url={team.songUrl!}
                  playCount={team.songPlayCount ?? 0}
                  addedByName={resolveUserName(team.songAddedBy)}
                  isActive={activeItem?.type === 'official' && activeItem?.index === index}
                  onActivate={() => setActiveItem({ type: 'official', index })}
                  onStarted={() => {
                    void incrementTeamSongPlayCount(team.id)
                    if (profile?.uid) void incrementUserSongPlay(profile.uid, team.id)
                  }}
                  onEnded={() => playNext('official', index)}
                  onPlayCountClick={canViewStats ? () => openTeamSongModal(team) : undefined}
                  nextTitle={getNextTitle('official', index)}
                  onNext={getNextTitle('official', index) !== undefined ? () => playNext('official', index) : undefined}
                  onPrev={index > 0 ? () => playPrev('official', index) : undefined}
                />
              </Box>
            ))}
          </Paper>
        )}
      </Stack>

      <Stack spacing={2}>
        <Typography variant="h5">Andre sanger 🎶</Typography>
        {sortedSongs.length > 0 && (
          <Paper variant="outlined">
            {sortedSongs.map((song, index) => (
              <Box key={song.id}>
                {index > 0 && <Divider />}
                <PlaylistRow
                  title={song.title}
                  url={song.url}
                  playCount={song.playCount ?? 0}
                  addedByName={resolveUserName(song.addedBy)}
                  isActive={activeItem?.type === 'other' && activeItem?.index === index}
                  onActivate={() => setActiveItem({ type: 'other', index })}
                  onStarted={() => void incrementSongPlayCount(song.id, profile?.uid)}
                  onEnded={() => playNext('other', index)}
                  onDelete={canEdit ? () => setDeleteConfirmSong(song) : undefined}
                  onPlayCountClick={canViewStats ? () => openSongModal(song) : undefined}
                  nextTitle={getNextTitle('other', index)}
                  onNext={getNextTitle('other', index) !== undefined ? () => playNext('other', index) : undefined}
                  onPrev={(index > 0 || teamsWithSong.length > 0) ? () => playPrev('other', index) : undefined}
                />
              </Box>
            ))}
          </Paper>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 4 }}>
          <Button
            variant="outlined"
            startIcon={<AddRoundedIcon />}
            onClick={() => setAddDialogOpen(true)}
          >
            Legg til sang
          </Button>
          {eggVisible && (
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

      {spotifyVisible && (
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

      <Dialog open={Boolean(deleteConfirmSong)} onClose={() => setDeleteConfirmSong(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Slett sang</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Er du sikker på at du vil slette «{deleteConfirmSong?.title}»?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmSong(null)}>Avbryt</Button>
          <Button
            color="error"
            onClick={() => {
              if (deleteConfirmSong) void deleteSong(deleteConfirmSong.id)
              setDeleteConfirmSong(null)
            }}
          >
            Slett
          </Button>
        </DialogActions>
      </Dialog>

      {playCountModal && (
        <PlayCountModal data={playCountModal} onClose={() => setPlayCountModal(null)} />
      )}
    </Stack>
  )
}
