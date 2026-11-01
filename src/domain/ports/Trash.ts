// PUERTO: "mandar algo a la Papelera". El dominio no sabe que existe Electron.
// En los tests lo reemplazamos por un fake que solo anota qué le pidieron.

export interface Trash {
  moveToTrash(path: string): Promise<void>
}
