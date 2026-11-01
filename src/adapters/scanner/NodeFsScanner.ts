// ADAPTADOR: implementación concreta del puerto usando el módulo `fs` de Node.

import { opendir, lstat } from 'node:fs/promises'
import { join } from 'node:path'
import type { DiskScanner } from '../../domain/ports/DiskScanner.js'
import type { ScanEvent } from '../../domain/FileEntry.js'

// Cuántos lstat pedimos EN PARALELO. Más no siempre es mejor:
// en un HDD mecánico, demasiados pedidos a la vez hacen saltar el cabezal.
const BATCH_SIZE = 64

export class NodeFsScanner implements DiskScanner {
  // `async function*` = generador asíncrono: va "entregando" resultados
  // de a uno (yield) en vez de juntar millones en memoria y devolverlos al final.
  async *scan(rootPath: string): AsyncIterable<ScanEvent> {
    let dir
    try {
      dir = await opendir(rootPath)
    } catch (err) {
      yield { kind: 'error', path: rootPath, reason: describe(err) }
      return
    }

    // 1) Leemos el contenido de ESTA carpeta y separamos archivos de subcarpetas.
    const files: { path: string; name: string }[] = []
    const subfolders: string[] = []

    for await (const dirent of dir) {
      // IMPORTANTE: en Windows hay "junctions" y symlinks que apuntan a otras carpetas.
      // Si los seguimos, contamos doble o entramos en un loop infinito.
      if (dirent.isSymbolicLink()) continue

      const fullPath = join(rootPath, dirent.name)
      if (dirent.isDirectory()) subfolders.push(fullPath)
      else if (dirent.isFile()) files.push({ path: fullPath, name: dirent.name })
    }

    // 2) Pedimos los datos de los archivos en lotes paralelos.
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE)
      // allSettled (no all): si UN archivo falla, los otros 63 igual se procesan.
      const results = await Promise.allSettled(batch.map((f) => lstat(f.path)))

      for (const [j, result] of results.entries()) {
        const file = batch[j]!
        if (result.status === 'rejected') {
          // Archivos en uso o sin permiso (pagefile.sys, etc). Se reporta y se sigue.
          yield { kind: 'error', path: file.path, reason: describe(result.reason) }
          continue
        }
        yield {
          kind: 'file',
          entry: {
            path: file.path,
            name: file.name,
            sizeBytes: result.value.size,
            lastAccess: result.value.atime,
            lastModified: result.value.mtime,
          },
        }
      }
    }

    // 3) Recursión: bajamos a cada subcarpeta con el mismo generador.
    for (const sub of subfolders) yield* this.scan(sub)
  }
}

function describe(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) return String(err.code)
  return String(err)
}
