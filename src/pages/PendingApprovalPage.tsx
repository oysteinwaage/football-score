import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded'
import { Alert, Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material'

export function PendingApprovalPage() {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '70vh' }}>
      <Card sx={{ width: '100%', maxWidth: 640 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
            <Chip icon={<HourglassTopRoundedIcon />} label="Venter på godkjenning" color="warning" />
            <Typography variant="h4">Venter på godkjenning</Typography>
            <Typography color="text.secondary">
              Kontoen din er registrert, men en administrator må godkjenne deg før du får tilgang til lag, kamper og live-funksjoner.
            </Typography>
            <Alert severity="info" sx={{ width: '100%' }}>
              Når en admin godkjenner deg, får du automatisk tilgang til innholdet du har fått tildelt.
            </Alert>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
