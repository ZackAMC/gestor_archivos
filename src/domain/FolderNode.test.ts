import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFolderNode, findFolder, removeFile, removeFolder, sortedChildren, type FolderNode } from './FolderNode.js'

function withTotals(node: FolderNode, sizeBytes: number, fileCount: number, coldBytes: number): FolderNode {
  return Object.assign(node, { sizeBytes, fileCount, coldBytes })
}

// F:\ (100) -> juegos (80) -> viejo (50)
function treeWithTotals() {
  const root = withTotals(createFolderNode('F:\\', 'F:\\'), 100, 10, 60)
  const juegos = withTotals(createFolderNode('juegos', 'F:\\juegos'), 80, 6, 50)
  const viejo = withTotals(createFolderNode('viejo', 'F:\\juegos\\viejo'), 50, 4, 50)
  juegos.children.set('viejo', viejo)
  root.children.set('juegos', juegos)
  return { root, juegos }
}

test('removeFolder quita la carpeta y descuenta de TODOS los ancestros', () => {
  const { root, juegos } = treeWithTotals()
  const removed = removeFolder(root, 'F:\\juegos\\viejo')
  assert.equal(removed?.name, 'viejo')
  assert.equal(juegos.children.has('viejo'), false)
  assert.deepEqual([juegos.sizeBytes, juegos.fileCount, juegos.coldBytes], [30, 2, 0])
  assert.deepEqual([root.sizeBytes, root.fileCount, root.coldBytes], [50, 6, 10])
})

test('removeFolder no hace nada con rutas que no existen o con la raíz', () => {
  const { root } = treeWithTotals()
  assert.equal(removeFolder(root, 'F:\\noexiste'), undefined)
  assert.equal(removeFolder(root, 'F:\\'), undefined)
  assert.equal(root.sizeBytes, 100)
})

test('removeFile descuenta un archivo de las carpetas que lo contienen', () => {
  const { root, juegos } = treeWithTotals()
  assert.equal(removeFile(root, 'F:\\juegos\\setup.exe', 20, true), true)
  assert.deepEqual([juegos.sizeBytes, juegos.fileCount, juegos.coldBytes], [60, 5, 30])
  assert.deepEqual([root.sizeBytes, root.fileCount, root.coldBytes], [80, 9, 40])
})

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
