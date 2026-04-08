import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material'
import { FormEvent, useEffect, useState } from 'react'

export interface ManualMatchValues {
  startsAt: string
  homeTeam: string
  awayTeam: string
  location: string
}

interface ManualMatchDialogProps {
  open: boolean
  teamName: string
  onClose: () => void
  onSubmit: (values: ManualMatchValues) => Promise<void>
}

export function ManualMatchDialog({ open, teamName, onClose, onSubmit }: ManualMatchDialogProps) {
  const [values, setValues] = useState<ManualMatchValues>({
    startsAt: '',
    homeTeam: teamName,
    awayTeam: '',
    location: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setValues({
        startsAt: '',
        homeTeam: teamName,
        awayTeam: '',
        location: '',
      })
    }
  }, [open, teamName])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)

    try {
      await onSubmit(values)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Legg til kamp</DialogTitle>
      <Stack component="form" onSubmit={handleSubmit}>
        <DialogContent>
          <Stack spacing={2}>
            <TextField
              label="Dato og tidspunkt"
              type="datetime-local"
              value={values.startsAt}
              onChange={(event) => setValues((previous) => ({ ...previous, startsAt: event.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
              required
            />
            <TextField
              label="Hjemmelag"
              value={values.homeTeam}
              onChange={(event) => setValues((previous) => ({ ...previous, homeTeam: event.target.value }))}
              required
            />
            <TextField
              label="Bortelag"
              value={values.awayTeam}
              onChange={(event) => setValues((previous) => ({ ...previous, awayTeam: event.target.value }))}
              required
            />
            <TextField
              label="Bane / sted"
              value={values.location}
              onChange={(event) => setValues((previous) => ({ ...previous, location: event.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={onClose}>Avbryt</Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? 'Lagrer...' : 'Opprett kamp'}
          </Button>
        </DialogActions>
      </Stack>
    </Dialog>
  )
}
