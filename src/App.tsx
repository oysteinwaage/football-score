import { Alert, Box, Card, CardContent, Stack, Typography } from '@mui/material'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'

import { AppShell } from './components/AppShell'
import { LoadingScreen } from './components/LoadingScreen'
import { OnboardingForm } from './components/OnboardingForm'
import { useAuth } from './context/AuthContext'
import { AdminPage } from './pages/AdminPage'
import { CreateTeamPage } from './pages/CreateTeamPage'
import { LoginPage } from './pages/LoginPage'
import { MatchPage } from './pages/MatchPage'
import { PendingApprovalPage } from './pages/PendingApprovalPage'
import { ProfilePage } from './pages/ProfilePage'
import { RetiredTeamsPage } from './pages/RetiredTeamsPage'
import { TeamPage } from './pages/TeamPage'
import { WelcomePage } from './pages/WelcomePage'
import { UserRole } from './types/domain'

function FirebaseConfigPage() {
  const { configError } = useAuth()

  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 760 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={2}>
            <Typography variant="h4">Firebase mangler konfigurasjon</Typography>
            <Alert severity="warning">{configError}</Alert>
            <Typography color="text.secondary">
              Legg inn verdiene i en lokal `.env`-fil med `VITE_FIREBASE_*`-variabler før du starter appen.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}

function ProtectedLayout() {
  const { firebaseReady, initializing, user, profile, profileMissing } = useAuth()
  const location = useLocation()

  if (!firebaseReady) {
    return <FirebaseConfigPage />
  }

  if (initializing) {
    return <LoadingScreen label="Klargjør bruker og tilgang ..." />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (profileMissing) {
    return (
      <AppShell>
        <OnboardingForm />
      </AppShell>
    )
  }

  if (!profile?.approved && location.pathname !== '/approval') {
    return <Navigate to="/approval" replace />
  }

  if (profile?.approved && location.pathname === '/approval') {
    return <Navigate to="/" replace />
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

function AdminRoute() {
  const { profile } = useAuth()

  if (!profile?.roles.includes(UserRole.ADMIN)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

function NotFoundPage() {
  const { user } = useAuth()

  return <Navigate to={user ? '/' : '/login'} replace />
}

function LoginWrapper() {
  const { firebaseReady, user, profile, profileMissing, initializing } = useAuth()

  if (!firebaseReady) {
    return <FirebaseConfigPage />
  }

  if (initializing) {
    return <LoadingScreen />
  }

  if (user && (profileMissing || !profile?.approved)) {
    return <Navigate to={profileMissing ? '/' : '/approval'} replace />
  }

  if (user && profile?.approved) {
    return <Navigate to="/" replace />
  }

  return <LoginPage />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginWrapper />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<WelcomePage />} />
        <Route path="/approval" element={<PendingApprovalPage />} />
        <Route path="/teams/:teamId" element={<TeamPage />} />
        <Route path="/matches/:matchId" element={<MatchPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/create-team" element={<CreateTeamPage />} />
          <Route path="/retired-teams" element={<RetiredTeamsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
