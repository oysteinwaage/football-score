import GoogleIcon from '@mui/icons-material/Google'
import { Alert, Box, Button, Card, CardContent, Stack, Typography } from '@mui/material'
import { useState } from 'react'

import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { signInWithGoogle, configError } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleLogin = async () => {
    setSubmitting(true)
    setError(null)

    try {
      await signInWithGoogle()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Innlogging feilet.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 560 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={3}>
            <div>
              <Typography variant="h3" gutterBottom>
                Football Score
              </Typography>
              <Typography color="text.secondary">
                Logg inn med Google for å følge laget, registrere kamphendelser og administrere tilgang.
              </Typography>
            </div>
            {configError && <Alert severity="warning">{configError}</Alert>}
            {error && <Alert severity="error">{error}</Alert>}
            <Button
              size="large"
              variant="contained"
              startIcon={<GoogleIcon />}
              onClick={() => void handleLogin()}
              disabled={submitting || Boolean(configError)}
            >
              {submitting ? 'Logger inn...' : 'Logg inn med Google'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
