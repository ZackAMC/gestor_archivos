// PRELOAD: el puente. Corre antes que la UI y expone una API CHICA y explícita.
// NUNCA exponer `ipcRenderer` entero: eso le daría a la UI acceso a cualquier canal.

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type DiskAnalyzerApi } from '../shared/contract.js'

const api: DiskAnalyzerApi = {
  pickFolder: () => ipcRenderer.invoke(IPC.pickFolder),
  scan: (rootPath, coldDays) => ipcRenderer.invoke(IPC.scan, rootPath, coldDays),
  children: (folderPath) => ipcRenderer.invoke(IPC.children, folderPath),
  onProgress: (listener) => {
    // Envolvemos para no pasarle a la UI el `event` (que trae `sender`).
    const handler = (_event: IpcRendererEvent, fileCount: number): void => listener(fileCount)
    ipcRenderer.on(IPC.progress, handler)
    return () => ipcRenderer.removeListener(IPC.progress, handler)
  },
  planDeletion: (items) => ipcRenderer.invoke(IPC.planDeletion, items),
  deleteSelection: (paths) => ipcRenderer.invoke(IPC.deleteSelection, paths),
  folders: (paths) => ipcRenderer.invoke(IPC.folders, paths),
}

contextBridge.exposeInMainWorld('api', api)
