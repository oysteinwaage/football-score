import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { useCollection } from '../hooks/useRealtimeDatabase'
import { addSong, deleteSong, incrementSongPlayCount } from '../services/songService'
import { incrementTeamSongPlayCount } from '../services/teamService'
import { incrementUserSongPlay } from '../services/userService'
import { SongRecord, TeamRecord, UserRole } from '../types/domain'

function SongPlayer({
  title, url, playCount, onPlay, onDelete,
}: {
  title: string
  url: string
  playCount?: number
  onPlay?: () => void
  onDelete?: () => void
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <MusicNoteRoundedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>{title}</Typography>
            {playCount !== undefined && (
              <Typography variant="caption" color="text.secondary">
                {playCount} {playCount === 1 ? 'avspilling' : 'avspillinger'}
              </Typography>
            )}
            {onDelete && (
              <IconButton size="small" color="error" onClick={onDelete} aria-label="Slett sang">
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
          <Box component="audio" controls src={url} sx={{ width: '100%' }} onPlay={onPlay} />
        </Stack>
      </CardContent>
    </Card>
  )
}

function AddSongForm({ onAdd }: { onAdd: (title: string, url: string) => Promise<void> }) {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke legge til sang.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
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
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Button
            variant="outlined"
            startIcon={<AddRoundedIcon />}
            onClick={() => void handleAdd()}
            disabled={saving || !title.trim() || !url.trim()}
            sx={{ alignSelf: 'flex-start' }}
          >
            {saving ? 'Legger til...' : 'Legg til sang'}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}

export function SangerPage() {
  const { profile } = useAuth()
  const { data: teams } = useCollection<TeamRecord>('teams')
  const { data: songs } = useCollection<SongRecord>('songs')

  const canEdit = Boolean(profile?.roles.some((r) => r === UserRole.ADMIN || r === UserRole.TRENER || r === UserRole.KAMPLEDER))

  const teamsWithSong = teams
    .filter((t) => t.songUrl && !t.retired)
    .sort((a, b) => (b.songPlayCount ?? 0) - (a.songPlayCount ?? 0))
  const sortedSongs = [...songs].sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0))

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
          />
        ))}
        <AddSongForm onAdd={async (title, url) => { await addSong(title, url, profile?.uid) }} />
      </Stack>
    </Stack>
  )
}
