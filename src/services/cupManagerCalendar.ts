import { ImportedFixture } from '../types/domain'

function unfoldIcs(content: string): string {
  return content.replace(/\r?\n[ \t]/g, '')
}

function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim()
}

function readProperty(block: string, propertyName: string): string {
  const line = block
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(propertyName))

  if (!line) {
    return ''
  }

  const colonIndex = line.indexOf(':')
  if (colonIndex === -1) {
    return ''
  }

  return unescapeIcsText(line.slice(colonIndex + 1))
}

function parseIcsDate(value: string): string {
  const match = value.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?/)

  if (!match) {
    throw new Error(`Ugyldig kalenderdato: ${value}`)
  }

  const [, year, month, day, hours, minutes, seconds = '00', utcMarker] = match
  const isoLike = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${utcMarker ? 'Z' : ''}`
  return new Date(isoLike).toISOString()
}

function stripAddressSuffix(location: string): string {
  const dashIndex = location.indexOf(' - ')
  return dashIndex === -1 ? location : location.slice(0, dashIndex).trim()
}

function parseHomeAwayFromDescription(description: string): [string, string] | null {
  const match = description.match(/mellom\s+(.+?)\s+och\s+(.+?)\.?\s*$/i)
  if (!match) {
    return null
  }

  const [, home, away] = match
  return [home.trim(), away.trim()]
}

export function parseCupManagerCalendar(content: string, sourceUrl: string): ImportedFixture[] {
  const unfolded = unfoldIcs(content)
  const blocks = unfolded.match(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g) ?? []

  const fixtures: Array<ImportedFixture | null> = blocks.map((block) => {
    const startsAtRaw = readProperty(block, 'DTSTART')
    const externalSourceId = readProperty(block, 'UID')
    const location = stripAddressSuffix(readProperty(block, 'LOCATION'))
    const description = readProperty(block, 'DESCRIPTION')
    const teams = parseHomeAwayFromDescription(description)

    if (!teams || !startsAtRaw || !externalSourceId) {
      return null
    }

    const [homeTeam, awayTeam] = teams

    return {
      externalSourceId,
      homeTeam,
      awayTeam,
      startsAt: parseIcsDate(startsAtRaw),
      location,
      sourceUrl,
    } satisfies ImportedFixture
  })

  return fixtures.filter((fixture): fixture is ImportedFixture => fixture !== null)
}

export async function fetchCupManagerCalendar(sourceUrl: string): Promise<ImportedFixture[]> {
  const response = await fetch(sourceUrl)

  if (!response.ok) {
    throw new Error(`Kalenderimport feilet med status ${response.status}.`)
  }

  const content = await response.text()
  return parseCupManagerCalendar(content, sourceUrl)
}
