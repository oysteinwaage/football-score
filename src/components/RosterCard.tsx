import AddRoundedIcon from '@mui/icons-material/AddRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import {
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'

interface RosterCardProps {
  title: string
  names: string[]
  canEdit: boolean
  suggestions?: string[]
  onRemove: (name: string) => Promise<void>
  onAdd: (name: string) => Promise<void>
}

export function RosterCard({ title, names, canEdit, suggestions = [], onRemove, onAdd }: RosterCardProps) {
  const [editing, setEditing] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleRemove = async (name: string) => {
    setSaving(true)
    try {
      await onRemove(name)
    } finally {
      setSaving(false)
    }
  }

  const handleAdd = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      await onAdd(trimmed)
      setNewName('')
      setAddOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">{title}</Typography>
            {canEdit && (
              <IconButton size="small" onClick={() => setEditing(!editing)} color={editing ? 'primary' : 'default'}>
                <EditRoundedIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            {names.map((name) => (
              <Chip
                key={name}
                label={name}
                onDelete={editing ? () => void handleRemove(name) : undefined}
                deleteIcon={<CloseRoundedIcon />}
                disabled={saving}
              />
            ))}
            {editing && (
              <Chip
                icon={<AddRoundedIcon />}
                label="Legg til"
                variant="outlined"
                onClick={() => setAddOpen(true)}
                disabled={saving}
              />
            )}
          </Stack>
        </Stack>
      </CardContent>

      <Dialog open={addOpen} onClose={() => !saving && setAddOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Legg til {title.toLowerCase()}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {suggestions.length > 0 && (
              <>
                <Typography variant="body2" color="text.secondary">
                  Fra laget:
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  {suggestions.map((s) => (
                    <Chip key={s} label={s} onClick={() => void handleAdd(s)} disabled={saving} />
                  ))}
                </Stack>
              </>
            )}
            <TextField
              label="Nytt navn"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleAdd(newName)}
              fullWidth
              autoFocus={suggestions.length === 0}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setAddOpen(false)} disabled={saving}>
            Avbryt
          </Button>
          <Button variant="contained" onClick={() => void handleAdd(newName)} disabled={saving || !newName.trim()}>
            Legg til
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}
