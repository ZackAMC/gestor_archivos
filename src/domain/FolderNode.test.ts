import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFolderNode, findFolder, sortedChildren } from './FolderNode.js'

function sampleTree() {
  const root = createFolderNode('F:\\proyectos', 'F:\\proyectos')
  const app = createFolderNode('app', 'F:\\proyectos\\app')
  const src = createFolderNode('src', 'F:\\proyectos\\app\\src')
  app.children.set('src', src)
  root.children.set('app', app)
  return { root, app, src }
}

test('findFolder encuentra la raíz y carpetas anidadas', () => {
  const { root, src } = sampleTree()
  assert.equal(findFolder(root, 'F:\\proyectos'), root)
  assert.equal(findFolder(root, 'F:\\proyectos\\app\\src'), src)
})

test('findFolder no confunde rutas que solo comparten prefijo', () => {
  const { root } = sampleTree()
  assert.equal(findFolder(root, 'F:\\proyectos2\\app'), undefined)
  assert.equal(findFolder(root, 'F:\\otra'), undefined)
  assert.equal(findFolder(root, 'F:\\proyectos\\noexiste'), undefined)
})

test('findFolder funciona cuando la raíz es una unidad (termina en barra)', () => {
  const root = createFolderNode('C:\\', 'C:\\')
  const users = createFolderNode('Users', 'C:\\Users')
  root.children.set('Users', users)
  assert.equal(findFolder(root, 'C:\\Users'), users)
})

test('sortedChildren ordena de mayor a menor tamaño', () => {
  const root = createFolderNode('r', 'r')
  const small = { ...createFolderNode('a', 'r\\a'), sizeBytes: 10 }
  const big = { ...createFolderNode('b', 'r\\b'), sizeBytes: 99 }
  root.children.set('a', small)
  root.children.set('b', big)
  assert.deepEqual(sortedChildren(root).map((f) => f.name), ['b', 'a'])
})
