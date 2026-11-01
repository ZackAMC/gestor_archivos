import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createColdPolicy, daysSinceUsed } from './ColdPolicy.js'
import type { FileEntry } from '../FileEntry.js'

const NOW = new Date('2026-11-01T12:00:00Z')

function entry(lastAccess: string, lastModified: string): FileEntry {
  return { path: 'F:\\x', name: 'x', sizeBytes: 1, lastAccess: new Date(lastAccess), lastModified: new Date(lastModified) }
}

test('usa la fecha MÁS RECIENTE entre acceso y modificación', () => {
  // Accedido hace mucho, pero modificado ayer -> se usó ayer.
  const e = entry('2025-01-01T12:00:00Z', '2026-10-31T12:00:00Z')
  assert.equal(daysSinceUsed(e, NOW), 1)
})

test('un archivo es frío si superó el umbral de días', () => {
  const isCold = createColdPolicy(180, NOW)
  assert.equal(isCold(entry('2026-01-01T12:00:00Z', '2026-01-01T12:00:00Z')), true)
})

test('un archivo NO es frío si un antivirus lo "tocó" hace poco (lado seguro)', () => {
  const isCold = createColdPolicy(180, NOW)
  // Modificado hace 2 años, pero atime de ayer (Defender lo escaneó).
  assert.equal(isCold(entry('2026-10-31T12:00:00Z', '2024-01-01T12:00:00Z')), false)
})
