// SERVICIO DE DOMINIO: arma el árbol de carpetas a medida que llegan los archivos.
// No toca el disco: recibe FileEntry y hace cuentas. Por eso es fácil de testear.

import type { FileEntry } from '../FileEntry.js'
import { createFolderNode, type FolderNode } from '../FolderNode.js'
import type { ColdPolicy } from './ColdPolicy.js'

const SEPARATOR = /[\\/]/ // Windows usa "\" pero aceptamos "/" también

export class FolderTreeBuilder {
  readonly root: FolderNode

  constructor(
    rootPath: string,
    private readonly isCold: ColdPolicy,
  ) {
    this.root = createFolderNode(rootPath, rootPath)
  }

  add(entry: FileEntry): void {
    // "F:\juegos\x\archivo.bin" con raíz "F:\" -> ["juegos", "x"]
    const relative = entry.path.slice(this.root.path.length).replace(/^[\\/]+/, '')
    const folders = relative.split(SEPARATOR)
    folders.pop() // el último segmento es el nombre del archivo, no una carpeta

    const cold = this.isCold(entry)

    // Bajamos por el árbol, sumando el archivo en CADA carpeta del camino.
    let node = this.root
    this.accumulate(node, entry, cold)
    for (const name of folders) {
      let child = node.children.get(name)
      if (!child) {
        child = createFolderNode(name, joinPath(node.path, name))
        node.children.set(name, child)
      }
      node = child
      this.accumulate(node, entry, cold)
    }
  }

  private accumulate(node: FolderNode, entry: FileEntry, cold: boolean): void {
    node.sizeBytes += entry.sizeBytes
    node.fileCount++
    if (cold) node.coldBytes += entry.sizeBytes
  }
}

function joinPath(parent: string, name: string): string {
  return /[\\/]$/.test(parent) ? parent + name : `${parent}\\${name}`
}
