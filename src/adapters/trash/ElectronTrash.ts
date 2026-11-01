// ADAPTADOR: implementa el puerto Trash con la API de Electron.
// shell.trashItem manda el archivo o carpeta a la Papelera de reciclaje de Windows.

import { shell } from 'electron'
import type { Trash } from '../../domain/ports/Trash.js'

export class ElectronTrash implements Trash {
  moveToTrash(path: string): Promise<void> {
    return shell.trashItem(path)
  }
}
