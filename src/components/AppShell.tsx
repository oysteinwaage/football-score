import MenuIcon from '@mui/icons-material/Menu'
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded'
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded'
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded'
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded'
import ShareRoundedIcon from '@mui/icons-material/ShareRounded'
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded'
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
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
import { QRCodeSVG } from 'qrcode.react'
import { ReactNode, useMemo, useState } from 'react'
import { Link as RouterLink, useLocation } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { useCollection } from '../hooks/useRealtimeDatabase'
import { TeamRecord, TeamType, UserRole } from '../types/domain'

const drawerWidth = 280

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [lagOpen, setLagOpen] = useState(false)
  const [lagCupOpen, setLagCupOpen] = useState(false)
  const [lagTestOpen, setLagTestOpen] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const APP_URL = 'https://football-score-omega.vercel.app/'

  const handleCopy = () => {
    void navigator.clipboard.writeText(APP_URL).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const location = useLocation()
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const { profile, signOutUser } = useAuth()
  const { data: allTeams } = useCollection<TeamRecord>('teams')

  const navigationItems = useMemo(() => {
    if (!profile?.approved) {
      return []
    }

    return [
      { label: 'Oversikt', icon: <HomeRoundedIcon />, href: '/' },
    ]
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
          const activeTeams = allTeams.filter((t) => profile.teamIds.includes(t.id) && !t.retired)
          const serieTeams = activeTeams.filter((t) => (t.teamType ?? TeamType.SERIE) === TeamType.SERIE)
          const cupTeams = activeTeams.filter((t) => t.teamType === TeamType.CUP)
          const testTeams = activeTeams.filter((t) => t.teamType === TeamType.TEST)

          return (
            <>
              {serieTeams.length === 1 && (
                <ListItemButton
                  component={RouterLink}
                  to={`/teams/${serieTeams[0].id}`}
                  selected={location.pathname === `/teams/${serieTeams[0].id}`}
                  onClick={() => setMobileOpen(false)}
                  sx={{ borderRadius: 3, mb: 0.5 }}
                >
                  <ListItemIcon><GroupsRoundedIcon /></ListItemIcon>
                  <ListItemText primary={serieTeams[0].name} />
                </ListItemButton>
              )}
              {serieTeams.length > 1 && (
                <>
                  <ListItemButton onClick={() => setLagOpen(!lagOpen)} sx={{ borderRadius: 3, mb: 0.5 }}>
                    <ListItemIcon><GroupsRoundedIcon /></ListItemIcon>
                    <ListItemText primary="Lag - serie" />
                    {lagOpen ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                  </ListItemButton>
                  <Collapse in={lagOpen} timeout="auto">
                    <List disablePadding sx={{ pl: 2 }}>
                      {serieTeams.map((team) => (
                        <ListItemButton
                          key={team.id}
                          component={RouterLink}
                          to={`/teams/${team.id}`}
                          selected={location.pathname === `/teams/${team.id}`}
                          onClick={() => setMobileOpen(false)}
                          sx={{ borderRadius: 3, mb: 0.5 }}
                        >
                          <ListItemText primary={team.name} />
                        </ListItemButton>
                      ))}
                    </List>
                  </Collapse>
                </>
              )}
              {cupTeams.length === 1 && (
                <ListItemButton
                  component={RouterLink}
                  to={`/teams/${cupTeams[0].id}`}
                  selected={location.pathname === `/teams/${cupTeams[0].id}`}
                  onClick={() => setMobileOpen(false)}
                  sx={{ borderRadius: 3, mb: 0.5 }}
                >
                  <ListItemIcon><GroupsRoundedIcon /></ListItemIcon>
                  <ListItemText primary={cupTeams[0].name} />
                </ListItemButton>
              )}
              {cupTeams.length > 1 && (
                <>
                  <ListItemButton onClick={() => setLagCupOpen(!lagCupOpen)} sx={{ borderRadius: 3, mb: 0.5 }}>
                    <ListItemIcon><GroupsRoundedIcon /></ListItemIcon>
                    <ListItemText primary="Lag - Cup" />
                    {lagCupOpen ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                  </ListItemButton>
                  <Collapse in={lagCupOpen} timeout="auto">
                    <List disablePadding sx={{ pl: 2 }}>
                      {cupTeams.map((team) => (
                        <ListItemButton
                          key={team.id}
                          component={RouterLink}
                          to={`/teams/${team.id}`}
                          selected={location.pathname === `/teams/${team.id}`}
                          onClick={() => setMobileOpen(false)}
                          sx={{ borderRadius: 3, mb: 0.5 }}
                        >
                          <ListItemText primary={team.name} />
                        </ListItemButton>
                      ))}
                    </List>
                  </Collapse>
                </>
              )}
              {testTeams.length === 1 && (
                <ListItemButton
                  component={RouterLink}
                  to={`/teams/${testTeams[0].id}`}
                  selected={location.pathname === `/teams/${testTeams[0].id}`}
                  onClick={() => setMobileOpen(false)}
                  sx={{ borderRadius: 3, mb: 0.5 }}
                >
                  <ListItemIcon><GroupsRoundedIcon /></ListItemIcon>
                  <ListItemText primary={testTeams[0].name} />
                </ListItemButton>
              )}
              {testTeams.length > 1 && (
                <>
                  <ListItemButton onClick={() => setLagTestOpen(!lagTestOpen)} sx={{ borderRadius: 3, mb: 0.5 }}>
                    <ListItemIcon><GroupsRoundedIcon /></ListItemIcon>
                    <ListItemText primary="TESTLAG" />
                    {lagTestOpen ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                  </ListItemButton>
                  <Collapse in={lagTestOpen} timeout="auto">
                    <List disablePadding sx={{ pl: 2 }}>
                      {testTeams.map((team) => (
                        <ListItemButton
                          key={team.id}
                          component={RouterLink}
                          to={`/teams/${team.id}`}
                          selected={location.pathname === `/teams/${team.id}`}
                          onClick={() => setMobileOpen(false)}
                          sx={{ borderRadius: 3, mb: 0.5 }}
                        >
                          <ListItemText primary={team.name} />
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
        {profile?.approved && profile.roles.includes(UserRole.TRENER) && (
          <ListItemButton
            component={RouterLink}
            to="/sanger"
            selected={location.pathname === '/sanger'}
            onClick={() => setMobileOpen(false)}
            sx={{ borderRadius: 3, mb: 0.5 }}
          >
            <ListItemIcon><MusicNoteRoundedIcon /></ListItemIcon>
            <ListItemText primary="Sanger" />
          </ListItemButton>
        )}
        {profile?.approved && profile.roles.includes(UserRole.ADMIN) && (
          <ListItemButton
            component={RouterLink}
            to="/admin"
            selected={location.pathname === '/admin'}
            onClick={() => setMobileOpen(false)}
            sx={{ borderRadius: 3, mb: 0.5 }}
          >
            <ListItemIcon><AdminPanelSettingsRoundedIcon /></ListItemIcon>
            <ListItemText primary="Admin" />
          </ListItemButton>
        )}
        {profile?.approved && (profile.roles.includes(UserRole.ADMIN) || profile.roles.includes(UserRole.STATS)) && (
          <ListItemButton
            component={RouterLink}
            to="/stats"
            selected={location.pathname === '/stats'}
            onClick={() => setMobileOpen(false)}
            sx={{ borderRadius: 3, mb: 0.5 }}
          >
            <ListItemIcon><BarChartRoundedIcon /></ListItemIcon>
            <ListItemText primary="Statistikk" />
          </ListItemButton>
        )}
        {profile?.approved && (profile.roles.includes(UserRole.ADMIN) || profile.roles.includes(UserRole.TRENER)) && (
          <ListItemButton
            component={RouterLink}
            to="/retired-teams"
            selected={location.pathname === '/retired-teams'}
            onClick={() => setMobileOpen(false)}
            sx={{ borderRadius: 3, mb: 0.5 }}
          >
            <ListItemIcon><ArchiveRoundedIcon /></ListItemIcon>
            <ListItemText primary="Pensjonerte lag" />
          </ListItemButton>
        )}
        <ListItemButton onClick={() => { setShareModalOpen(true); setMobileOpen(false) }} sx={{ borderRadius: 3, mb: 0.5 }}>
          <ListItemIcon><ShareRoundedIcon /></ListItemIcon>
          <ListItemText primary="Del app'en" />
        </ListItemButton>
        {profile?.approved && (
          <ListItemButton
            component={RouterLink}
            to="/profile"
            selected={location.pathname === '/profile'}
            onClick={() => setMobileOpen(false)}
            sx={{ borderRadius: 3, mb: 0.5 }}
          >
            <ListItemIcon><AccountCircleRoundedIcon /></ListItemIcon>
            <ListItemText primary="Min side" />
          </ListItemButton>
        )}
        <ListItemButton onClick={() => void signOutUser()} sx={{ borderRadius: 3 }}>
          <ListItemIcon><LogoutRoundedIcon /></ListItemIcon>
          <ListItemText primary="Logg ut" />
        </ListItemButton>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Dialog open={shareModalOpen} onClose={() => setShareModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Del app'en</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ alignItems: 'center', py: 1 }}>
            <QRCodeSVG value={APP_URL} size={220} />
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              Scan QR-koden for å åpne appen
            </Typography>
            <Button
              variant="outlined"
              fullWidth
              startIcon={copied ? <CheckRoundedIcon /> : <ContentCopyRoundedIcon />}
              onClick={handleCopy}
              color={copied ? 'success' : 'primary'}
            >
              {copied ? 'Lenke kopiert!' : 'Kopier lenke'}
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
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
