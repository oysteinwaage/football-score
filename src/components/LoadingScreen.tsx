import { Box, CircularProgress, Typography } from '@mui/material'

export function LoadingScreen({ label = 'Laster...' }: { label?: string }) {
  return (
    <Box
      sx={{
        minHeight: '60vh',
        display: 'grid',
        placeItems: 'center',
        gap: 2,
        textAlign: 'center',
      }}
    >
      <div>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>{label}</Typography>
      </div>
    </Box>
  )
}
