// REGLA DE NEGOCIO: ¿cuándo consideramos que un archivo "no se usa"?

import type { FileEntry } from '../FileEntry.js'

const DAY_MS = 24 * 60 * 60 * 1000

// El último acceso (atime) no es confiable: el antivirus o el indexador lo "tocan".
// Tomamos la fecha MÁS RECIENTE entre acceso y modificación.
// Si nos equivocamos, el archivo parece "en uso" -> nunca sugerimos borrar algo de más.
export function lastUsed(entry: FileEntry): Date {
  return new Date(Math.max(entry.lastAccess.getTime(), entry.lastModified.getTime()))
}

export function daysSinceUsed(entry: FileEntry, now: Date = new Date()): number {
  return Math.floor((now.getTime() - lastUsed(entry).getTime()) / DAY_MS)
}

// Devuelve una FUNCIÓN que decide. `now` se inyecta para poder testear con fechas fijas.
export function createColdPolicy(thresholdDays: number, now: Date = new Date()) {
  return (entry: FileEntry): boolean => daysSinceUsed(entry, now) >= thresholdDays
}

export type ColdPolicy = ReturnType<typeof createColdPolicy>
