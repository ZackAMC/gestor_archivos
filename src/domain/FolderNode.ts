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
