// PROCESO MAIN (Node completo): el ÚNICO que toca el disco.
// Es otro adaptador de entrada, igual que el CLI: traduce pedidos IPC a llamadas al caso de uso.

import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeFsScanner } from '../adapters/scanner/NodeFsScanner.js'
import { scanDisk, type ScanResult } from '../application/ScanDisk.js'
import type { FileEntry } from '../domain/FileEntry.js'
import { findFolder, sortedChildren, type FolderNode } from '../domain/FolderNode.js'
import { daysSinceUsed } from '../domain/services/ColdPolicy.js'
import { IPC, type FileDTO, type FolderDTO, type ScanSummaryDTO } from '../shared/contract.js'

const here = dirname(fileURLToPath(import.meta.url))
const scanner = new NodeFsScanner()

// El árbol completo se queda ACÁ. Con 500k archivos, mandarlo entero a la UI sería carísimo.
// La UI pide los hijos de una carpeta cuando entra en ella (carga bajo demanda).
let lastScan: ScanResult | null = null
let scanning = false

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    title: 'Disk Analyzer',
    webPreferences: {
      preload: join(here, '../preload/index.cjs'),
      contextIsolation: true, // la UI y el preload viven en mundos JS separados
      nodeIntegration: false, // la UI NO puede hacer require('fs')
      sandbox: true, // el renderer corre con permisos de pestaña de navegador
    },
  })

  // En desarrollo, electron-vite levanta un servidor con recarga en caliente.
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(here, '../renderer/index.html'))
}

// --- Handlers IPC. Todo lo que llega del renderer es INPUT NO CONFIABLE: se valida. ---

ipcMain.handle(IPC.pickFolder, async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const options = { properties: ['openDirectory' as const] }
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
  return result.canceled ? null : (result.filePaths[0] ?? null)
})

ipcMain.handle(IPC.scan, async (event, rootPath: unknown, coldDays: unknown): Promise<ScanSummaryDTO> => {
  if (typeof rootPath !== 'string' || rootPath.trim() === '') throw new Error('Ruta inválida')
  if (typeof coldDays !== 'number' || !Number.isInteger(coldDays) || coldDays < 0) throw new Error('Días inválidos')
  if (scanning) throw new Error('Ya hay un escaneo en curso')

  scanning = true
  try {
    lastScan = await scanDisk(scanner, resolve(rootPath), {
      coldDays,
      onProgress: (n) => {
        if (!event.sender.isDestroyed()) event.sender.send(IPC.progress, n)
      },
    })
    return toSummary(lastScan)
  } finally {
    scanning = false
  }
})

ipcMain.handle(IPC.children, (_event, folderPath: unknown): FolderDTO[] => {
  if (typeof folderPath !== 'string' || !lastScan) return []
  const node = findFolder(lastScan.root, folderPath)
  return node ? sortedChildren(node).map(toFolderDTO) : []
})
// --- Traducción dominio -> DTO (lo que cruza el puente) ---

function toSummary(scan: ScanResult): ScanSummaryDTO {
  return {
    root: toFolderDTO(scan.root),
    children: sortedChildren(scan.root).map(toFolderDTO),
    biggestFiles: scan.biggestFiles.map(toFileDTO),
    biggestColdFiles: scan.biggestColdFiles.map(toFileDTO),
    errorCount: scan.errorCount,
    seconds: scan.seconds,
    coldDays: scan.coldDays,
  }
}

function toFolderDTO(node: FolderNode): FolderDTO {
  return {
    name: node.name,
    path: node.path,
    sizeBytes: node.sizeBytes,
    fileCount: node.fileCount,
    coldBytes: node.coldBytes,
    hasChildren: node.children.size > 0,
  }
}

function toFileDTO(entry: FileEntry): FileDTO {
  return { name: entry.name, path: entry.path, sizeBytes: entry.sizeBytes, daysSinceUsed: daysSinceUsed(entry) }
}

// --- Ciclo de vida ---

void app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
