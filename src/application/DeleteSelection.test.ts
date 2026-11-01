import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Trash } from '../domain/ports/Trash.js'
import { deleteSelection } from './DeleteSelection.js'

// FAKE del puerto: no toca el disco, solo anota qué le pidieron borrar.
class FakeTrash implements Trash {
  readonly calls: string[] = []
  constructor(private readonly failing: Set<string> = new Set()) {}

  async moveToTrash(path: string): Promise<void> {
    this.calls.push(path)
    if (this.failing.has(path)) throw new Error('EBUSY')
  }
}

test('lo bloqueado NUNCA llega a la Papelera', async () => {
  const trash = new FakeTrash()
  const report = await deleteSelection(trash, [
    { path: 'C:\\Windows', sizeBytes: 100 },
    { path: 'C:\\pagefile.sys', sizeBytes: 50 },
    { path: 'F:\\proyectos\\app\\node_modules', sizeBytes: 10 },
  ])
  assert.deepEqual(trash.calls, ['F:\\proyectos\\app\\node_modules'])
  assert.equal(report.trashedBytes, 10)
  assert.equal(report.outcomes[0]!.status, 'blocked')
})

test('no borra dos veces lo que ya va incluido en una carpeta padre', async () => {
  const trash = new FakeTrash()
  const report = await deleteSelection(trash, [
    { path: 'F:\\proyectos\\app', sizeBytes: 100 },
    { path: 'F:\\proyectos\\app\\node_modules', sizeBytes: 60 },
  ])
  assert.deepEqual(trash.calls, ['F:\\proyectos\\app'])
  assert.equal(report.outcomes[1]!.status, 'covered')
  assert.equal(report.trashedBytes, 100)
})

test('un fallo no corta el resto y queda reportado', async () => {
  const trash = new FakeTrash(new Set(['F:\\a']))
  const report = await deleteSelection(trash, [
    { path: 'F:\\a', sizeBytes: 5 },
    { path: 'F:\\b', sizeBytes: 7 },
  ])
  assert.deepEqual(trash.calls, ['F:\\a', 'F:\\b'])
  assert.equal(report.failedCount, 1)
  assert.equal(report.outcomes[0]!.reason, 'EBUSY')
  assert.equal(report.trashedBytes, 7)
})
