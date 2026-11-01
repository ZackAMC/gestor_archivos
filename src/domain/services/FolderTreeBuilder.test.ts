import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FolderTreeBuilder } from './FolderTreeBuilder.js'
import type { FileEntry } from '../FileEntry.js'

const neverCold = () => false
const alwaysCold = () => true

function file(path: string, sizeBytes: number): FileEntry {
  const date = new Date('2026-01-01')
  return { path, name: path.split('\\').pop()!, sizeBytes, lastAccess: date, lastModified: date }
}

test('el tamaño de un archivo se suma en todas las carpetas del camino', () => {
  const tree = new FolderTreeBuilder('F:\\', neverCold)
  tree.add(file('F:\\juegos\\rpg\\save.dat', 100))

  const juegos = tree.root.children.get('juegos')!
  const rpg = juegos.children.get('rpg')!

  assert.equal(tree.root.sizeBytes, 100)
  assert.equal(juegos.sizeBytes, 100)
  assert.equal(rpg.sizeBytes, 100)
  assert.equal(rpg.path, 'F:\\juegos\\rpg')
})

test('carpetas hermanas acumulan por separado y el padre suma ambas', () => {
  const tree = new FolderTreeBuilder('F:\\datos', neverCold)
  tree.add(file('F:\\datos\\a\\1.bin', 10))
  tree.add(file('F:\\datos\\a\\2.bin', 20))
  tree.add(file('F:\\datos\\b\\3.bin', 5))

  assert.equal(tree.root.children.get('a')!.sizeBytes, 30)
  assert.equal(tree.root.children.get('b')!.sizeBytes, 5)
  assert.equal(tree.root.sizeBytes, 35)
  assert.equal(tree.root.fileCount, 3)
})

test('un archivo directamente en la raíz no crea subcarpetas', () => {
  const tree = new FolderTreeBuilder('F:\\datos', neverCold)
  tree.add(file('F:\\datos\\suelto.txt', 7))

  assert.equal(tree.root.children.size, 0)
  assert.equal(tree.root.sizeBytes, 7)
})

test('los bytes fríos se acumulan según la política', () => {
  const tree = new FolderTreeBuilder('F:\\', alwaysCold)
  tree.add(file('F:\\viejo\\x.iso', 500))

  assert.equal(tree.root.coldBytes, 500)
  assert.equal(tree.root.children.get('viejo')!.coldBytes, 500)
})
