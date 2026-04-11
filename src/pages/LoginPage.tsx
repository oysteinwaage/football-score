import GoogleIcon from '@mui/icons-material/Google'
import MicrosoftIcon from '@mui/icons-material/Microsoft'
import { Alert, Box, Button, Card, CardContent, Divider, Stack, Typography } from '@mui/material'
import { useState } from 'react'

import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { signInWithGoogle, signInWithMicrosoft, configError } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<'google' | 'microsoft' | null>(null)

  const handleGoogleLogin = async () => {
    setSubmitting('google')
    setError(null)

    try {
      await signInWithGoogle()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Innlogging feilet.')
    } finally {
      setSubmitting(null)
    }
  }

  const handleMicrosoftLogin = async () => {
    setSubmitting('microsoft')
    setError(null)

    try {
      await signInWithMicrosoft()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Innlogging feilet.')
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 560 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={3}>
            <div>
              <Typography variant="h3" gutterBottom>
                Live Score
              </Typography>
              <Typography color="text.secondary">
                Logg inn for å følge laget, registrere kamphendelser og administrere tilgang.
              </Typography>
            </div>
            {configError && <Alert severity="warning">{configError}</Alert>}
            {error && <Alert severity="error">{error}</Alert>}
            <Button
              size="large"
              variant="contained"
              startIcon={<GoogleIcon />}
              onClick={() => void handleGoogleLogin()}
              disabled={submitting !== null || Boolean(configError)}
            >
              {submitting === 'google' ? 'Logger inn...' : 'Logg inn med Google'}
            </Button>
            <Divider>eller</Divider>
            <Button
              size="large"
              variant="outlined"
              startIcon={<MicrosoftIcon />}
              onClick={() => void handleMicrosoftLogin()}
              disabled={submitting !== null || Boolean(configError)}
            >
              {submitting === 'microsoft' ? 'Logger inn...' : 'Logg inn med Microsoft'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
