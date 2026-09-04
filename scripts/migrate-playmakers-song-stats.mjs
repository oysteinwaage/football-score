// Engangsmigrering: flytter avspillingsstatistikk for Playmakers' gamle offisielle
// lagsang fra lag-objektet (teams/{id}/songPlayCount) og brukerne (users/{uid}/songPlays/{teamId})
// over til sangen i songs-tabellen. Krever innlogget firebase-tools med tilgang til prosjektet.
//
// Kjør:        node scripts/migrate-playmakers-song-stats.mjs --apply
// Dry run:     node scripts/migrate-playmakers-song-stats.mjs

import { execFileSync } from 'node:child_process'

const PROJECT = 'football-score-fbad8'
const TEAM_ID = '-Oprg0G9qBnbDav-RdSF'
const SONG_ID = '-OuktejbFRRh_1LvTaQn'
const APPLY = process.argv.includes('--apply')

const FIREBASE = ['-y', 'firebase-tools@latest']

function fb(...args) {
  return execFileSync('npx', [...FIREBASE, ...args, '--project', PROJECT], { encoding: 'utf8' })
}

function dbGet(path) {
  return JSON.parse(fb('database:get', path))
}

const team = dbGet(`/teams/${TEAM_ID}`)
const song = dbGet(`/songs/${SONG_ID}`)
const users = dbGet('/users')

if (!team) throw new Error('Fant ikke laget.')
if (!song) throw new Error('Fant ikke sangen i songs-tabellen.')

const teamUserPlays = {}
for (const [uid, user] of Object.entries(users ?? {})) {
  const plays = user?.songPlays?.[TEAM_ID]
  if (typeof plays === 'number' && plays > 0) teamUserPlays[uid] = plays
}

const mergedUserPlays = { ...(song.userPlays ?? {}) }
for (const [uid, plays] of Object.entries(teamUserPlays)) {
  mergedUserPlays[uid] = (mergedUserPlays[uid] ?? 0) + plays
}
const mergedPlayCount = (song.playCount ?? 0) + (team.songPlayCount ?? 0)

console.log(`Lag:  ${team.name} — songPlayCount: ${team.songPlayCount ?? 0}`)
console.log(`Sang: ${song.title} — playCount: ${song.playCount ?? 0}`)
console.log(`Flyttes fra ${Object.keys(teamUserPlays).length} brukere (sum ${Object.values(teamUserPlays).reduce((a, b) => a + b, 0)})`)
console.log('Resultat på sangen:', JSON.stringify({ playCount: mergedPlayCount, userPlays: mergedUserPlays }, null, 2))

if (!APPLY) {
  console.log('\nDry run — kjør med --apply for å utføre.')
  process.exit(0)
}

fb('database:update', `/songs/${SONG_ID}`, '--data', JSON.stringify({ playCount: mergedPlayCount, userPlays: mergedUserPlays }), '--force')
console.log('Sangen er oppdatert.')

fb('database:remove', `/teams/${TEAM_ID}/songPlayCount`, '--force')
console.log('songPlayCount fjernet fra laget.')

for (const uid of Object.keys(teamUserPlays)) {
  fb('database:remove', `/users/${uid}/songPlays/${TEAM_ID}`, '--force')
  console.log(`songPlays fjernet for bruker ${uid}`)
}

console.log('\nFerdig. Verifiserer:')
console.log('Sang:', JSON.stringify(dbGet(`/songs/${SONG_ID}`)))
console.log('Lagets songPlayCount:', JSON.stringify(dbGet(`/teams/${TEAM_ID}/songPlayCount`)))
