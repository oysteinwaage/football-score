import { CoachRecord, UserProfile, UserRole } from '../types/domain'

/**
 * Navn som kan velges som trener: registrerte trenere, pluss fornavnet til brukere med
 * Trener-rollen som ennå ikke er koblet til en registrert trener.
 */
export function getCoachOptionNames(coaches: CoachRecord[], users: UserProfile[], exclude: string[] = []): string[] {
  const linkedUserIds = new Set(coaches.map((c) => c.userId).filter(Boolean))
  const names = new Set<string>()

  coaches.forEach((coach) => {
    if (coach.name.trim()) names.add(coach.name.trim())
  })
  users
    .filter((u) => u.roles.includes(UserRole.TRENER) && !linkedUserIds.has(u.id) && u.parentName.trim())
    .forEach((u) => names.add(u.parentName.trim().split(' ')[0]))

  const excluded = new Set(exclude.map((name) => name.trim().toLowerCase()))
  return Array.from(names)
    .filter((name) => !excluded.has(name.toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'no'))
}
