// DOMINIO: una carpeta del árbol, con los totales de TODO lo que contiene (recursivo).

export interface FolderNode {
  name: string
  path: string
  sizeBytes: number // suma de todos los archivos dentro (incluye subcarpetas)
  fileCount: number
  coldBytes: number // cuánto de ese tamaño son archivos "fríos"
  children: Map<string, FolderNode> // Map: buscar una subcarpeta por nombre es O(1)
}

export function createFolderNode(name: string, path: string): FolderNode {
  return { name, path, sizeBytes: 0, fileCount: 0, coldBytes: 0, children: new Map() }
}

// Busca una carpeta del árbol por su ruta completa, bajando nombre por nombre.
export function findFolder(root: FolderNode, path: string): FolderNode | undefined {
  const names = relativeNames(root, path)
  if (!names) return undefined

  let node: FolderNode | undefined = root
  for (const name of names) {
    node = node.children.get(name)
    if (!node) return undefined
  }
  return node
}

export function sortedChildren(node: FolderNode): FolderNode[] {
  return [...node.children.values()].sort((a, b) => b.sizeBytes - a.sizeBytes)
}

// Saca una carpeta del árbol y descuenta sus totales de TODOS sus ancestros.
// Devuelve el nodo quitado, o undefined si no existe.
export function removeFolder(root: FolderNode, path: string): FolderNode | undefined {
  const chain = chainTo(root, path)
  const name = relativeNames(root, path)?.at(-1)
  if (!chain || !name) return undefined

  const parent = chain[chain.length - 1]!
  const node = parent.children.get(name)
  if (!node) return undefined

  for (const ancestor of chain) {
    ancestor.sizeBytes -= node.sizeBytes
    ancestor.fileCount -= node.fileCount
    ancestor.coldBytes -= node.coldBytes
  }
  parent.children.delete(name)
  return node
}

// Descuenta UN archivo de todas las carpetas que lo contienen.
export function removeFile(root: FolderNode, path: string, sizeBytes: number, cold: boolean): boolean {
  const chain = chainTo(root, path)
  if (!chain) return false

  for (const ancestor of chain) {
    ancestor.sizeBytes -= sizeBytes
    ancestor.fileCount -= 1
    if (cold) ancestor.coldBytes -= sizeBytes
  }
  return true
}

// "F:\a\b\c" con raíz "F:\" -> ["a", "b", "c"]. undefined si la ruta no está bajo la raíz.
function relativeNames(root: FolderNode, path: string): string[] | undefined {
  if (!path.startsWith(root.path)) return undefined
  const rest = path.slice(root.path.length)
  // Evita que la raíz "F:\proyectos" matchee "F:\proyectos2\..." solo porque empieza igual.
  if (!/[\\/]$/.test(root.path) && rest !== '' && !/^[\\/]/.test(rest)) return undefined
  return rest.split(/[\\/]/).filter(Boolean)
}

// Nodos desde la raíz hasta la carpeta que CONTIENE a `path` (sin incluir el último segmento).
function chainTo(root: FolderNode, path: string): FolderNode[] | undefined {
  const names = relativeNames(root, path)
  if (!names || names.length === 0) return undefined

  const chain = [root]
  let node = root
  for (const name of names.slice(0, -1)) {
    const next = node.children.get(name)
    if (!next) return undefined
    node = next
    chain.push(node)
  }
  return chain
}
