// CASO DE USO: "escanear una carpeta". Orquesta el puerto y los servicios de dominio.
// Lo usan DOS adaptadores de entrada (el CLI y Electron) y la lógica vive en UN solo lugar.

import type { DiskScanner } from '../domain/ports/DiskScanner.js'
import type { FileEntry } from '../domain/FileEntry.js'
import type { FolderNode } from '../domain/FolderNode.js'
import { createColdPolicy } from '../domain/services/ColdPolicy.js'
import { FolderTreeBuilder } from '../domain/services/FolderTreeBuilder.js'
import { TopList } from '../domain/services/TopList.js'

export interface ScanOptions {
  coldDays: number
  topN?: number
  // Callback en vez de console.log: el caso de uso NO sabe si hay una consola o una ventana.
  onProgress?: (fileCount: number) => void
  progressEvery?: number
}

export interface ScanResult {
  root: FolderNode
  biggestFiles: FileEntry[]
  biggestColdFiles: FileEntry[]
  errorCount: number
  seconds: number
  coldDays: number
}

export async function scanDisk(scanner: DiskScanner, rootPath: string, options: ScanOptions): Promise<ScanResult> {
  const { coldDays, topN = 15, onProgress, progressEvery = 5000 } = options

  const isCold = createColdPolicy(coldDays)
  const tree = new FolderTreeBuilder(rootPath, isCold)
  const biggestFiles = new TopList<FileEntry>(topN, (f) => f.sizeBytes)
  const biggestColdFiles = new TopList<FileEntry>(topN, (f) => f.sizeBytes)

  let errorCount = 0
  const start = performance.now()

  for await (const event of scanner.scan(rootPath)) {
    if (event.kind === 'error') {
      errorCount++
      continue
    }
    tree.add(event.entry)
    biggestFiles.add(event.entry)
    if (isCold(event.entry)) biggestColdFiles.add(event.entry)

    if (onProgress && tree.root.fileCount % progressEvery === 0) onProgress(tree.root.fileCount)
  }

  return {
    root: tree.root,
    biggestFiles: biggestFiles.values(),
    biggestColdFiles: biggestColdFiles.values(),
    errorCount,
    seconds: (performance.now() - start) / 1000,
    coldDays,
  }
}
