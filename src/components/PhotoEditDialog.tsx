import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from '@mui/material'
import { useRef } from 'react'

interface Props {
  open: boolean
  hasPhoto: boolean
  uploading: boolean
  deleting: boolean
  onClose: () => void
  onUpload: (file: File) => void
  onDelete: () => void
}

export function PhotoEditDialog({ open, hasPhoto, uploading, deleting, onClose, onUpload, onDelete }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const busy = uploading || deleting

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="xs">
      <DialogTitle>Rediger lagbilde</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <Button
            variant="outlined"
            fullWidth
            startIcon={uploading ? <CircularProgress size={16} /> : <PhotoCameraRoundedIcon />}
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {uploading ? 'Laster opp...' : hasPhoto ? 'Bytt bilde' : 'Last opp bilde'}
          </Button>
          {hasPhoto && (
            <Button
              variant="outlined"
              color="error"
              fullWidth
              startIcon={deleting ? <CircularProgress size={16} /> : <DeleteOutlineRoundedIcon />}
              onClick={onDelete}
              disabled={busy}
            >
              {deleting ? 'Sletter...' : 'Fjern bilde'}
            </Button>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button onClick={onClose} disabled={busy}>Avbryt</Button>
      </DialogActions>
    </Dialog>
  )
}
