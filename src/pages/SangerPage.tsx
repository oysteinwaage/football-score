import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import { keyframes } from '@mui/system'
import { useEffect, useRef, useState } from 'react'

import trulsFjes from '../assets/truls_fjes.png'

import { useAuth } from '../context/AuthContext'
import { useCachedAudioSrc } from '../hooks/useCachedAudioSrc'
import { useCollection } from '../hooks/useRealtimeDatabase'
import { addSong, attachMp3ToSong, deleteSong, incrementSongPlayCount, validateMp3File } from '../services/songService'
import { attachMp3ToTeamSong, incrementTeamSongPlayCount } from '../services/teamService'
import { incrementUserSongPlay } from '../services/userService'
import { SongRecord, TeamRecord, UserProfile, UserRole } from '../types/domain'
import { getSunoSongPageUrl, hasTeamSong } from '../utils/songUrl'

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

function Mp3UploadButton({ onUpload }: { onUpload: (file: File) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    const validationError = validateMp3File(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setUploading(true)
    setError(null)
    try {
      await onUpload(file)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste opp mp3-filen.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,audio/mpeg"
        hidden
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      {uploading ? (
        <Box sx={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={18} />
        </Box>
      ) : (
        <Tooltip title="Last opp mp3-fil">
          <IconButton size="small" color="primary" onClick={() => inputRef.current?.click()} aria-label="Last opp mp3-fil">
            <UploadFileRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      <Dialog open={Boolean(error)} onClose={() => setError(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Opplasting feilet</DialogTitle>
        <DialogContent>
          <DialogContentText>{error}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setError(null)}>OK</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

function PlaylistRow({
  title,
  url,
  mp3Url,
  playCount,
  addedByName,
  isActive,
  onActivate,
  onStarted,
  onEnded,
  onDelete,
  onUploadMp3,
  onPlayCountClick,
  nextTitle,
}: {
  title: string
  url: string
  mp3Url?: string
  playCount?: number
  addedByName?: string
  isActive: boolean
  onActivate: () => void
  onStarted?: () => void
  onEnded?: () => void
  onDelete?: () => void
  onUploadMp3?: (file: File) => Promise<void>
  onPlayCountClick?: () => void
  nextTitle?: string
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [audioPlaying, setAudioPlaying] = useState(false)
  // Opplastet mp3 går foran; ellers lenkes det til Suno slik som før
  const sunoSongUrl = mp3Url ? null : getSunoSongPageUrl(url)
  const { src: cachedMp3Src, loading: audioLoading } = useCachedAudioSrc(mp3Url, isActive)
  const audioSrc = mp3Url ? cachedMp3Src : sunoSongUrl ? undefined : url

  useEffect(() => {
    if (sunoSongUrl) return
    const audio = audioRef.current
    if (!audio) return
    if (isActive) {
      if (audioSrc) audio.play().catch(() => undefined)
    } else {
      audio.pause()
    }
  }, [isActive, sunoSongUrl, audioSrc])

  const openSunoTab = () => {
    window.open(sunoSongUrl!, '_blank', 'noopener,noreferrer')
    onStarted?.()
  }

  const handlePlayPauseClick = () => {
    if (sunoSongUrl) {
      if (!isActive) onActivate()
      openSunoTab()
      return
    }
    if (!isActive) {
      onActivate()
      return
    }
    const audio = audioRef.current
    if (!audio) return
    if (audioPlaying) {
      audio.pause()
    } else {
      audio.play().catch(() => undefined)
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
        {isActive && sunoSongUrl && (
          <IconButton
            size="small"
            onClick={openSunoTab}
            color="primary"
            sx={{ flexShrink: 0 }}
            aria-label="Åpne på suno.com"
          >
            <OpenInNewRoundedIcon fontSize="small" />
          </IconButton>
        )}
        {isActive && !sunoSongUrl && (
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
        {onUploadMp3 && <Mp3UploadButton onUpload={onUploadMp3} />}
        {onDelete && (
          <IconButton size="small" color="error" onClick={onDelete} aria-label="Slett sang">
            <DeleteOutlineRoundedIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
      <Collapse in={isActive} unmountOnExit={false}>
        <Box sx={{ px: 2, pb: 1.5 }}>
          {sunoSongUrl ? (
            <Stack spacing={1}>
              <Alert severity="info" sx={{ py: 0.5 }}>
                Suno tillater ikke lenger avspilling direkte i appen 😭 — sangen spilles av på suno.com i en ny fane.
              </Alert>
              <Button
                variant="outlined"
                size="small"
                startIcon={<OpenInNewRoundedIcon />}
                onClick={openSunoTab}
                sx={{ alignSelf: 'flex-start' }}
              >
                Åpne på suno.com
              </Button>
            </Stack>
          ) : (
            <>
              {audioLoading && <LinearProgress sx={{ mb: 1, borderRadius: 1 }} />}
              <Box
                component="audio"
                ref={audioRef}
                controls
                src={audioSrc}
                preload="none"
                sx={{ width: '100%' }}
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
            </>
          )}
          {nextTitle && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <span>Neste sang: {nextTitle}</span>
              {sunoSongUrl && onEnded && (
                <Button size="small" onClick={onEnded} sx={{ minWidth: 0, py: 0 }}>
                  Spill neste
                </Button>
              )}
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
  onAdd: (title: string, url: string, mp3File?: File) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [source, setSource] = useState<'link' | 'mp3'>('link')
  const [url, setUrl] = useState('')
  const [mp3File, setMp3File] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const canSubmit = Boolean(title.trim()) && (source === 'link' ? Boolean(url.trim()) : Boolean(mp3File))

  const reset = () => {
    setTitle('')
    setSource('link')
    setUrl('')
    setMp3File(null)
    setError(null)
  }

  const handleFile = (file: File | undefined) => {
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return
    const validationError = validateMp3File(file)
    if (validationError) {
      setError(validationError)
      setMp3File(null)
      return
    }
    setError(null)
    setMp3File(file)
    if (!title.trim()) setTitle(file.name.replace(/\.mp3$/i, ''))
  }

  const handleAdd = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      if (source === 'link') {
        await onAdd(title, url)
      } else {
        await onAdd(title, '', mp3File!)
      }
      reset()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke legge til sang.')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    if (saving) return
    reset()
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
          <ToggleButtonGroup
            value={source}
            exclusive
            fullWidth
            size="small"
            color="primary"
            disabled={saving}
            onChange={(_, value: 'link' | 'mp3' | null) => {
              if (value) {
                setSource(value)
                setError(null)
              }
            }}
          >
            <ToggleButton value="link">Lenke</ToggleButton>
            <ToggleButton value="mp3">Last opp mp3</ToggleButton>
          </ToggleButtonGroup>
          {source === 'link' ? (
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
          ) : (
            <Stack spacing={1}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,audio/mpeg"
                hidden
                onChange={(e) => { handleFile(e.target.files?.[0]) }}
              />
              <Button
                variant="outlined"
                startIcon={<UploadFileRoundedIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
              >
                {mp3File ? 'Velg en annen fil' : 'Velg mp3-fil'}
              </Button>
              {mp3File && (
                <Typography variant="body2" color="text.secondary" noWrap>
                  {mp3File.name} ({(mp3File.size / 1024 / 1024).toFixed(1)} MB)
                </Typography>
              )}
            </Stack>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          {saving && source === 'mp3' && <LinearProgress />}
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => void handleAdd()}
            disabled={saving || !canSubmit}
          >
            {saving ? (source === 'mp3' ? 'Laster opp...' : 'Legger til...') : 'Legg til sang'}
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
  const canUploadMp3 = canViewStats

  const resolveUserName = (uid?: string) => {
    if (!uid) return undefined
    const u = users.find((u) => u.id === uid || u.uid === uid)
    return u ? (u.parentName || u.displayName || u.childName || undefined) : undefined
  }

  const teamsWithSong = teams
    .filter((t) => hasTeamSong(t) && !t.retired)
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
                  url={team.songUrl ?? ''}
                  mp3Url={team.songMp3Url}
                  playCount={team.songPlayCount ?? 0}
                  addedByName={resolveUserName(team.songAddedBy)}
                  isActive={activeItem?.type === 'official' && activeItem?.index === index}
                  onActivate={() => setActiveItem({ type: 'official', index })}
                  onStarted={() => {
                    void incrementTeamSongPlayCount(team.id)
                    if (profile?.uid) void incrementUserSongPlay(profile.uid, team.id)
                  }}
                  onEnded={() => playNext('official', index)}
                  onUploadMp3={canUploadMp3 && !team.songMp3Url ? (file) => attachMp3ToTeamSong(team.id, file) : undefined}
                  onPlayCountClick={canViewStats ? () => openTeamSongModal(team) : undefined}
                  nextTitle={getNextTitle('official', index)}
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
                  mp3Url={song.mp3Url}
                  playCount={song.playCount ?? 0}
                  addedByName={resolveUserName(song.addedBy)}
                  isActive={activeItem?.type === 'other' && activeItem?.index === index}
                  onActivate={() => setActiveItem({ type: 'other', index })}
                  onStarted={() => void incrementSongPlayCount(song.id, profile?.uid)}
                  onEnded={() => playNext('other', index)}
                  onDelete={canEdit ? () => setDeleteConfirmSong(song) : undefined}
                  onUploadMp3={canUploadMp3 && !song.mp3Url ? (file) => attachMp3ToSong(song.id, file) : undefined}
                  onPlayCountClick={canViewStats ? () => openSongModal(song) : undefined}
                  nextTitle={getNextTitle('other', index)}
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
        onAdd={async (title, url, mp3File) => { await addSong(title, url, profile?.uid, mp3File) }}
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
              if (deleteConfirmSong) void deleteSong(deleteConfirmSong)
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
