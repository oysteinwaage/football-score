import MenuIcon from '@mui/icons-material/Menu'
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded'
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded'
import {
  AppBar,
  Avatar,
  Box,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { onValue, ref } from 'firebase/database'
import { ReactNode, useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, useLocation } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { database } from '../firebase/config'
import { TeamRecord, UserRole } from '../types/domain'

const drawerWidth = 280

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [lagOpen, setLagOpen] = useState(false)
  const [teamNames, setTeamNames] = useState<Record<string, string>>({})
  const location = useLocation()
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const { profile, signOutUser } = useAuth()

  useEffect(() => {
    if (!database || !profile?.teamIds?.length) return
    const unsubscribers = profile.teamIds.map((teamId) =>
      onValue(ref(database!, `teams/${teamId}`), (snapshot) => {
        const team = snapshot.val() as TeamRecord | null
        if (team) setTeamNames((prev) => ({ ...prev, [teamId]: team.name }))
      }),
    )
    return () => unsubscribers.forEach((unsub) => unsub())
  }, [profile?.teamIds])

  const navigationItems = useMemo(() => {
    if (!profile?.approved) {
      return []
    }

    const items = [{ label: 'Oversikt', icon: <HomeRoundedIcon />, href: '/' }]

    if (profile.roles.includes(UserRole.ADMIN)) {
      items.push({ label: 'Admin', icon: <AdminPanelSettingsRoundedIcon />, href: '/admin' })
    }

    return items
  }, [profile])

  const drawer = (
    <Box sx={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
      <Box sx={{ p: 3 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Avatar sx={{ bgcolor: 'primary.main' }}>
            <SportsSoccerRoundedIcon />
          </Avatar>
          <Box>
            <Typography variant="h6">Football Score</Typography>
            <Typography variant="body2" color="text.secondary">
              Følg med på gutta!
            </Typography>
          </Box>
        </Stack>
      </Box>
      <Divider />
      <List sx={{ px: 1, py: 2, flex: 1 }}>
        {navigationItems.map((item) => (
          <ListItemButton
            key={item.href}
            component={RouterLink}
            to={item.href}
            selected={location.pathname === item.href}
            onClick={() => setMobileOpen(false)}
            sx={{ borderRadius: 3, mb: 0.5 }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
        {profile?.approved && profile.teamIds.length === 1 && (
          <ListItemButton
            component={RouterLink}
            to={`/teams/${profile.teamIds[0]}`}
            selected={location.pathname === `/teams/${profile.teamIds[0]}`}
            onClick={() => setMobileOpen(false)}
            sx={{ borderRadius: 3, mb: 0.5 }}
          >
            <ListItemIcon>
              <GroupsRoundedIcon />
            </ListItemIcon>
            <ListItemText primary="Lag" />
          </ListItemButton>
        )}
        {profile?.approved && profile.teamIds.length > 1 && (
          <>
            <ListItemButton onClick={() => setLagOpen(!lagOpen)} sx={{ borderRadius: 3, mb: 0.5 }}>
              <ListItemIcon>
                <GroupsRoundedIcon />
              </ListItemIcon>
              <ListItemText primary="Lag" />
              {lagOpen ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
            </ListItemButton>
            <Collapse in={lagOpen} timeout="auto">
              <List disablePadding sx={{ pl: 2 }}>
                {profile.teamIds.map((teamId) => (
                  <ListItemButton
                    key={teamId}
                    component={RouterLink}
                    to={`/teams/${teamId}`}
                    selected={location.pathname === `/teams/${teamId}`}
                    onClick={() => setMobileOpen(false)}
                    sx={{ borderRadius: 3, mb: 0.5 }}
                  >
                    <ListItemText primary={teamNames[teamId] ?? teamId} />
                  </ListItemButton>
                ))}
              </List>
            </Collapse>
          </>
        )}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {profile ? `${profile.parentName} · ${profile.childName}` : 'Ikke logget inn'}
        </Typography>
        <ListItemButton onClick={() => void signOutUser()} sx={{ borderRadius: 3 }}>
          <ListItemIcon>
            <LogoutRoundedIcon />
          </ListItemIcon>
          <ListItemText primary="Logg ut" />
        </ListItemButton>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(14px)',
        }}
      >
        <Toolbar sx={{ gap: 2 }}>
          {!isDesktop && (
            <IconButton edge="start" onClick={() => setMobileOpen(true)}>
              <MenuIcon />
            </IconButton>
          )}
          <Box>
            <Typography variant="h6">Football Score - VASK G2016</Typography>
            <Typography variant="body2" color="text.secondary">
              {profile?.approved ? '' : 'Registrering og godkjenning'}
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={isDesktop ? 'permanent' : 'temporary'}
          open={isDesktop ? true : mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              borderRight: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flex: 1, width: '100%', p: { xs: 2, md: 4 }, mt: 9 }}>
        {children}
      </Box>
    </Box>
  )
}
