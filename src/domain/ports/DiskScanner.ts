// PUERTO: el contrato. Dice QUÉ necesita la app, no CÓMO se hace.
// Hoy lo implementa NodeFsScanner. Mañana podría ser un lector de MFT,
// y nada que dependa de esta interfaz se entera del cambio.

import type { ScanEvent } from '../FileEntry.js'

export interface DiskScanner {
  scan(rootPath: string): AsyncIterable<ScanEvent>
}
