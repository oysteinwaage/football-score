import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded'
import AddBoxRoundedIcon from '@mui/icons-material/AddBoxRounded'
import { Box, IconButton, Paper, Typography } from '@mui/material'
import { useEffect, useRef, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { incrementIosInstallBannerCount } from '../services/userService'

const MAX_SHOW_COUNT = 5

function isIosInBrowser(): boolean {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
  if (!isIOS) return false
  const standalone = (window.navigator as { standalone?: boolean }).standalone
  return standalone !== true
}

export function InstallBanner() {
  const { profile } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const hasIncremented = useRef(false)

  const shouldShow =
    !!profile?.id &&
    isIosInBrowser() &&
    (profile.iosInstallBannerCount ?? 0) < MAX_SHOW_COUNT

  useEffect(() => {
    if (shouldShow && !hasIncremented.current) {
      hasIncremented.current = true
      void incrementIosInstallBannerCount(profile!.id)
    }
  }, [shouldShow, profile])

  if (!shouldShow || dismissed) return null

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 16,
        left: 12,
        right: 12,
        zIndex: 1400,
        pointerEvents: 'none',
      }}
    >
      <Paper
        elevation={4}
        sx={{
          pointerEvents: 'auto',
          borderRadius: 4,
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box
          component="img"
          src="/VASK_logo.png"
          alt="Live Score"
          sx={{ width: 36, height: 36, borderRadius: 2, flexShrink: 0, mt: 0.25 }}
        />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" fontWeight={700} color="text.primary" display="block" lineHeight={1.3}>
            iPhone-tips: Legg til som app på Hjem-skjerm
          </Typography>
          <Box component="ol" sx={{ m: 0, mt: 0.5, p: 0, listStyle: 'none' }}>
            {[
              <>Trykk <strong>«···»</strong> nederst til høyre i Safari</>,
              <>Velg <strong>Del</strong> <IosShareRoundedIcon sx={{ fontSize: 12, verticalAlign: 'middle', mb: '2px' }} /></>,
              <>Scroll ned og trykk <AddBoxRoundedIcon sx={{ fontSize: 12, verticalAlign: 'middle', mb: '2px' }} /> <strong>«Legg til på Hjem-skjerm»</strong></>,
            ].map((step, i) => (
              <Typography
                key={i}
                component="li"
                variant="caption"
                color="text.secondary"
                display="block"
                lineHeight={1.4}
              >
                <Typography component="span" variant="caption" fontWeight={600} color="text.primary">
                  {i + 1}.{' '}
                </Typography>
                {step}
              </Typography>
            ))}
          </Box>
        </Box>

        <IconButton
          size="small"
          onClick={() => setDismissed(true)}
          aria-label="Lukk"
          sx={{ flexShrink: 0, mt: -0.5, mr: -0.5, color: 'text.disabled' }}
        >
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </Paper>
    </Box>
  )
}
