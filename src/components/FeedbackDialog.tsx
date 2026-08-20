import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material'
import { useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { submitFeedback } from '../services/feedbackService'
import { FeedbackType } from '../types/domain'

const feedbackTypeLabels: Record<FeedbackType, string> = {
  [FeedbackType.FEIL]: 'Feil / problem',
  [FeedbackType.FORSLAG]: 'Forbedringsforslag',
  [FeedbackType.ANNET]: 'Annet',
}

export function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, profile } = useAuth()
  const [type, setType] = useState<FeedbackType>(FeedbackType.FORSLAG)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleClose = () => {
    if (submitting) return
    setType(FeedbackType.FORSLAG)
    setMessage('')
    setErrorMessage(null)
    onClose()
  }

  const handleSubmit = async () => {
    if (!user || !message.trim()) return

    setSubmitting(true)
    setErrorMessage(null)

    try {
      await submitFeedback(user.uid, profile?.parentName ?? user.displayName ?? 'Ukjent bruker', type, message.trim())
      handleClose()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Kunne ikke sende tilbakemeldingen.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Send tilbakemelding</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
          <FormControl size="small">
            <InputLabel>Type</InputLabel>
            <Select label="Type" value={type} onChange={(e) => setType(e.target.value as FeedbackType)}>
              {(Object.values(FeedbackType) as FeedbackType[]).map((value) => (
                <MenuItem key={value} value={value}>{feedbackTypeLabels[value]}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Melding"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            multiline
            minRows={4}
            required
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={handleClose} disabled={submitting}>Avbryt</Button>
        <Button variant="contained" onClick={() => void handleSubmit()} disabled={submitting || !message.trim()}>
          {submitting ? 'Sender...' : 'Send'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
