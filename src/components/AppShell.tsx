import MenuIcon from '@mui/icons-material/Menu'
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
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
import { TeamRecord, TeamType, UserRole } from '../types/domain'

const drawerWidth = 280

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [lagOpen, setLagOpen] = useState(false)
  const [lagCupOpen, setLagCupOpen] = useState(false)
  const [lagTestOpen, setLagTestOpen] = useState(false)
  const [teamData, setTeamData] = useState<Record<string, { name: string; teamType: TeamType }>>({})

  const location = useLocation()
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const { profile, signOutUser } = useAuth()

  useEffect(() => {
    if (!database || !profile?.teamIds?.length) return
    const unsubscribers = profile.teamIds.map((teamId) =>
      onValue(ref(database!, `teams/${teamId}`), (snapshot) => {
        const team = snapshot.val() as TeamRecord | null
        if (team) setTeamData((prev) => ({ ...prev, [teamId]: { name: team.name, teamType: team.teamType ?? TeamType.SERIE } }))
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
            <Typography variant="h6">Live Score</Typography>
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
        {profile?.approved && (() => {
          const serieIds = profile.teamIds.filter((id) => (teamData[id]?.teamType ?? TeamType.SERIE) === TeamType.SERIE)
          const cupIds = profile.teamIds.filter((id) => teamData[id]?.teamType === TeamType.CUP)
          const testIds = profile.teamIds.filter((id) => teamData[id]?.teamType === TeamType.TEST)

          return (
            <>
              {serieIds.length === 1 && (
                <ListItemButton
                  component={RouterLink}
                  to={`/teams/${serieIds[0]}`}
                  selected={location.pathname === `/teams/${serieIds[0]}`}
                  onClick={() => setMobileOpen(false)}
                  sx={{ borderRadius: 3, mb: 0.5 }}
                >
                  <ListItemIcon><GroupsRoundedIcon /></ListItemIcon>
                  <ListItemText primary={teamData[serieIds[0]]?.name ?? 'Lag - serie'} />
                </ListItemButton>
              )}
              {serieIds.length > 1 && (
                <>
                  <ListItemButton onClick={() => setLagOpen(!lagOpen)} sx={{ borderRadius: 3, mb: 0.5 }}>
                    <ListItemIcon><GroupsRoundedIcon /></ListItemIcon>
                    <ListItemText primary="Lag - serie" />
                    {lagOpen ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                  </ListItemButton>
                  <Collapse in={lagOpen} timeout="auto">
                    <List disablePadding sx={{ pl: 2 }}>
                      {serieIds.map((teamId) => (
                        <ListItemButton
                          key={teamId}
                          component={RouterLink}
                          to={`/teams/${teamId}`}
                          selected={location.pathname === `/teams/${teamId}`}
                          onClick={() => setMobileOpen(false)}
                          sx={{ borderRadius: 3, mb: 0.5 }}
                        >
                          <ListItemText primary={teamData[teamId]?.name ?? teamId} />
                        </ListItemButton>
                      ))}
                    </List>
                  </Collapse>
                </>
              )}
              {cupIds.length === 1 && (
                <ListItemButton
                  component={RouterLink}
                  to={`/teams/${cupIds[0]}`}
                  selected={location.pathname === `/teams/${cupIds[0]}`}
                  onClick={() => setMobileOpen(false)}
                  sx={{ borderRadius: 3, mb: 0.5 }}
                >
                  <ListItemIcon><GroupsRoundedIcon /></ListItemIcon>
                  <ListItemText primary={teamData[cupIds[0]]?.name ?? 'Lag - Cup'} />
                </ListItemButton>
              )}
              {cupIds.length > 1 && (
                <>
                  <ListItemButton onClick={() => setLagCupOpen(!lagCupOpen)} sx={{ borderRadius: 3, mb: 0.5 }}>
                    <ListItemIcon><GroupsRoundedIcon /></ListItemIcon>
                    <ListItemText primary="Lag - Cup" />
                    {lagCupOpen ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                  </ListItemButton>
                  <Collapse in={lagCupOpen} timeout="auto">
                    <List disablePadding sx={{ pl: 2 }}>
                      {cupIds.map((teamId) => (
                        <ListItemButton
                          key={teamId}
                          component={RouterLink}
                          to={`/teams/${teamId}`}
                          selected={location.pathname === `/teams/${teamId}`}
                          onClick={() => setMobileOpen(false)}
                          sx={{ borderRadius: 3, mb: 0.5 }}
                        >
                          <ListItemText primary={teamData[teamId]?.name ?? teamId} />
                        </ListItemButton>
                      ))}
                    </List>
                  </Collapse>
                </>
              )}
              {testIds.length === 1 && (
                <ListItemButton
                  component={RouterLink}
                  to={`/teams/${testIds[0]}`}
                  selected={location.pathname === `/teams/${testIds[0]}`}
                  onClick={() => setMobileOpen(false)}
                  sx={{ borderRadius: 3, mb: 0.5 }}
                >
                  <ListItemIcon><GroupsRoundedIcon /></ListItemIcon>
                  <ListItemText primary={teamData[testIds[0]]?.name ?? 'TESTLAG'} />
                </ListItemButton>
              )}
              {testIds.length > 1 && (
                <>
                  <ListItemButton onClick={() => setLagTestOpen(!lagTestOpen)} sx={{ borderRadius: 3, mb: 0.5 }}>
                    <ListItemIcon><GroupsRoundedIcon /></ListItemIcon>
                    <ListItemText primary="TESTLAG" />
                    {lagTestOpen ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                  </ListItemButton>
                  <Collapse in={lagTestOpen} timeout="auto">
                    <List disablePadding sx={{ pl: 2 }}>
                      {testIds.map((teamId) => (
                        <ListItemButton
                          key={teamId}
                          component={RouterLink}
                          to={`/teams/${teamId}`}
                          selected={location.pathname === `/teams/${teamId}`}
                          onClick={() => setMobileOpen(false)}
                          sx={{ borderRadius: 3, mb: 0.5 }}
                        >
                          <ListItemText primary={teamData[teamId]?.name ?? teamId} />
                        </ListItemButton>
                      ))}
                    </List>
                  </Collapse>
                </>
              )}
            </>
          )
        })()}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        {profile?.approved && profile.roles.includes(UserRole.ADMIN) && (
          <ListItemButton
            component={RouterLink}
            to="/create-team"
            selected={location.pathname === '/create-team'}
            onClick={() => setMobileOpen(false)}
            sx={{ borderRadius: 3, mb: 0.5 }}
          >
            <ListItemIcon>
              <AddRoundedIcon />
            </ListItemIcon>
            <ListItemText primary="Opprett lag" />
          </ListItemButton>
        )}
        {profile?.approved && (
          <ListItemButton
            component={RouterLink}
            to="/profile"
            selected={location.pathname === '/profile'}
            onClick={() => setMobileOpen(false)}
            sx={{ borderRadius: 3, mb: 0.5 }}
          >
            <ListItemIcon>
              <AccountCircleRoundedIcon />
            </ListItemIcon>
            <ListItemText primary="Min side" />
          </ListItemButton>
        )}
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
            <Typography variant="h6">Live Score - VASK G2016</Typography>
            <Typography variant="body2" color="text.secondary">
              {profile?.approved
                ? `${profile.parentName} (${profile.roles.map((r) => r.charAt(0).toUpperCase() + r.slice(1).toLowerCase()).join(', ')})`
                : 'Registrering og godkjenning'}
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
