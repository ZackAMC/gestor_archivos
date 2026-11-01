// DOMINIO: qué es "un archivo" para nuestra app.
// No sabe nada de Node, ni de Windows, ni de Electron. Es solo información.

export interface FileEntry {
  path: string
  name: string
  sizeBytes: number
  lastAccess: Date // cuándo se leyó por última vez (aproximado en NTFS)
  lastModified: Date // cuándo se escribió por última vez
}

// El escaneo puede encontrar archivos... o problemas (sin permisos, bloqueado, etc).
// En vez de tirar excepciones y cortar todo, los reportamos como eventos.
export type ScanEvent =
  | { kind: 'file'; entry: FileEntry }
  | { kind: 'error'; path: string; reason: string }
