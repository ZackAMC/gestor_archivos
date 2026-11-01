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
  if (path === root.path) return root
  if (!path.startsWith(root.path)) return undefined

  const rest = path.slice(root.path.length)
  // Evita que la raíz "F:\proyectos" matchee "F:\proyectos2\..." solo porque empieza igual.
  if (!/[\\/]$/.test(root.path) && !/^[\\/]/.test(rest)) return undefined

  let node: FolderNode | undefined = root
  for (const name of rest.split(/[\\/]/).filter(Boolean)) {
    node = node.children.get(name)
    if (!node) return undefined
  }
  return node
}

export function sortedChildren(node: FolderNode): FolderNode[] {
  return [...node.children.values()].sort((a, b) => b.sizeBytes - a.sizeBytes)
}
