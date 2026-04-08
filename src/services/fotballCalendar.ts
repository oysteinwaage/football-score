import { ImportedFixture } from '../types/domain'

function unfoldIcs(content: string): string {
  return content.replace(/\r?\n[ \t]/g, '')
}

function parseIcsDate(value: string): string {
  const match = value.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?/) 

  if (!match) {
    throw new Error(`Ugyldig kalenderdato: ${value}`)
  }

  const [, year, month, day, hours, minutes, seconds = '00'] = match
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds),
  ).toISOString()
}

function readProperty(block: string, propertyName: string): string {
  const line = block
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(propertyName))

  if (!line) {
    return ''
  }

  const [, value] = line.split(':', 2)
  return value ?? ''
}

export function parseFotballCalendar(content: string, sourceUrl: string): ImportedFixture[] {
  const unfolded = unfoldIcs(content)
  const matches = unfolded.match(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g) ?? []

  const fixtures: Array<ImportedFixture | null> = matches.map((block) => {
      const summary = readProperty(block, 'SUMMARY')
      const [homeTeam, awayTeam] = summary.split(' - ').map((part) => part.trim())
      const startsAtRaw = readProperty(block, 'DTSTART')
      const externalSourceId = readProperty(block, 'UID')
      const location = readProperty(block, 'LOCATION')

      if (!homeTeam || !awayTeam || !startsAtRaw || !externalSourceId) {
        return null
      }

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

export async function fetchFotballCalendar(sourceUrl: string): Promise<ImportedFixture[]> {
  const response = await fetch(sourceUrl)

  if (!response.ok) {
    throw new Error(`Kalenderimport feilet med status ${response.status}.`) 
  }

  const content = await response.text()
  return parseFotballCalendar(content, sourceUrl)
}
