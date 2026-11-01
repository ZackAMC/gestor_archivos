// PROCESO MAIN (Node completo): el ÚNICO que toca el disco.
// Es otro adaptador de entrada, igual que el CLI: traduce pedidos IPC a llamadas al caso de uso.

import { app, BrowserWindow, dialog, ipcMain, type MessageBoxOptions } from 'electron'
import { statfs } from 'node:fs/promises'
import { dirname, join, parse, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeFsScanner } from '../adapters/scanner/NodeFsScanner.js'
import { ElectronTrash } from '../adapters/trash/ElectronTrash.js'
import { deleteSelection, type DeletionReport } from '../application/DeleteSelection.js'
import { scanDisk, type ScanResult } from '../application/ScanDisk.js'
import type { FileEntry } from '../domain/FileEntry.js'
import { findFolder, removeFile, removeFolder, sortedChildren, type FolderNode } from '../domain/FolderNode.js'
import { createColdPolicy, daysSinceUsed } from '../domain/services/ColdPolicy.js'
import { isInside, planDeletion, type DeletionCandidate, type PlannedItem } from '../domain/services/DeletionPlan.js'
import { normalizeWinPath } from '../domain/services/DeletionRisk.js'
import {
  IPC,
  type DeleteResultDTO,
  type DeletionPlanDTO,
  type FileDTO,
  type FolderDTO,
  type ScanSummaryDTO,
} from '../shared/contract.js'
import { formatBytes } from '../shared/format.js'

const here = dirname(fileURLToPath(import.meta.url))
const scanner = new NodeFsScanner()
const trash = new ElectronTrash()

// El árbol completo se queda ACÁ. Con 500k archivos, mandarlo entero a la UI sería carísimo.
// La UI pide los hijos de una carpeta cuando entra en ella (carga bajo demanda).
let lastScan: ScanResult | null = null
let scanning = false
let deleting = false

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
  if (scanning || deleting) throw new Error('Esperá a que termine la operación en curso')

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

// El riesgo se evalúa en MAIN, no en la UI: cuando exista el borrado, Main va a usar
// esta misma regla para negarse a borrar lo bloqueado, haga lo que haga la UI.
ipcMain.handle(IPC.planDeletion, (_event, items: unknown): DeletionPlanDTO => {
  if (!Array.isArray(items) || items.length > 10_000) throw new Error('Selección inválida')
  const candidates: DeletionCandidate[] = items.map((it: unknown) => {
    if (!it || typeof it !== 'object') throw new Error('Ítem inválido')
    const { path, sizeBytes } = it as Record<string, unknown>
    if (typeof path !== 'string' || typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes < 0) {
      throw new Error('Ítem inválido')
    }
    return { path, sizeBytes }
  })
  // El plan del dominio ya es un objeto plano con la misma forma que el DTO:
  // el tipado estructural de TS lo acepta sin mapear.
  return planDeletion(candidates)
})

ipcMain.handle(IPC.folders, (_event, paths: unknown): (FolderDTO | null)[] => {
  if (!lastScan || !isStringArray(paths)) return []
  const root = lastScan.root
  return paths.map((p) => {
    const node = findFolder(root, p)
    return node ? toFolderDTO(node) : null
  })
})

// --- BORRADO ---
// Seguridad en capas:
// 1) Main solo acepta rutas que salieron de SU escaneo, con los tamaños de SU árbol.
// 2) El caso de uso vuelve a evaluar el riesgo: lo bloqueado nunca llega a la Papelera.
// 3) La confirmación es un diálogo NATIVO abierto por Main: la UI no lo puede saltear.

interface ResolvedItem extends DeletionCandidate {
  kind: 'folder' | 'file'
  entry: FileEntry | null
}

ipcMain.handle(IPC.deleteSelection, async (event, paths: unknown): Promise<DeleteResultDTO | null> => {
  if (!lastScan) throw new Error('Primero escaneá una carpeta')
  if (!isStringArray(paths) || paths.length === 0) throw new Error('Selección inválida')
  if (scanning || deleting) throw new Error('Esperá a que termine la operación en curso')

  const scan = lastScan
  const resolved = paths.map((p) => resolveFromScan(scan, p))
  const unknown = paths.filter((_, i) => resolved[i] === null)
  if (unknown.length > 0) throw new Error(`No pertenecen al último escaneo: ${unknown.join(', ')}`)
  const items = resolved as ResolvedItem[]

  const plan = planDeletion(items)
  const toTrash = plan.items.filter((it) => it.risk.level !== 'blocked' && it.coveredBy === null)
  if (toTrash.length === 0) throw new Error('No hay nada que se pueda borrar en la selección')

  const win = BrowserWindow.fromWebContents(event.sender)
  if (!(await confirmDeletion(win, toTrash))) return null

  deleting = true
  try {
    const report = await deleteSelection(trash, items)
    applyToTree(scan, items, report)
    return { report, summary: toSummary(scan) }
  } finally {
    deleting = false
  }
})

function resolveFromScan(scan: ScanResult, path: string): ResolvedItem | null {
  const folder = findFolder(scan.root, path)
  if (folder && folder !== scan.root) return { path, sizeBytes: folder.sizeBytes, kind: 'folder', entry: null }

  const file = [...scan.biggestFiles, ...scan.biggestColdFiles].find((f) => f.path === path)
  return file ? { path, sizeBytes: file.sizeBytes, kind: 'file', entry: file } : null
}

async function confirmDeletion(win: BrowserWindow | null, items: PlannedItem[]): Promise<boolean> {
  const total = items.reduce((acc, it) => acc + it.sizeBytes, 0)
  const highRisk = items.filter((it) => it.risk.level === 'high')
  const tooBig = await itemsThatMayNotFitInRecycleBin(items)

  const lines = items.slice(0, 8).map((it) => `• ${it.path}  (${formatBytes(it.sizeBytes)})`)
  if (items.length > 8) lines.push(`… y ${items.length - 8} más`)

  const warnings: string[] = []
  if (highRisk.length > 0) warnings.push(`⚠ ${highRisk.length} con RIESGO ALTO: revisá que tengas copia.`)
  if (tooBig.length > 0) {
    warnings.push(
      `⚠ ${tooBig.length} ${tooBig.length === 1 ? 'es muy grande' : 'son muy grandes'} para la Papelera de su disco. ` +
        'Si no entra, Windows podría borrarlo PERMANENTEMENTE.',
    )
  }

  const options: MessageBoxOptions = {
    type: 'warning',
    title: 'Confirmar borrado',
    message: `¿Mandar ${items.length} ${items.length === 1 ? 'ítem' : 'ítems'} a la Papelera? Liberarías ${formatBytes(total)}.`,
    detail: [...lines, ...(warnings.length > 0 ? ['', ...warnings] : [])].join('\n'),
    buttons: ['Cancelar', 'Mandar a la Papelera'],
    defaultId: 0, // Enter = Cancelar. Borrar tiene que ser una decisión, no un reflejo.
    cancelId: 0,
    noLink: true,
  }
  const { response } = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options)
  return response === 1
}

// ESTIMACIÓN: la Papelera de Windows suele reservar alrededor del 5% del disco.
// Si no podemos medir el disco, asumimos lo peor y avisamos igual.
const RECYCLE_BIN_SHARE = 0.05

async function itemsThatMayNotFitInRecycleBin(items: PlannedItem[]): Promise<PlannedItem[]> {
  const result: PlannedItem[] = []
  for (const it of items) {
    try {
      const fs = await statfs(parse(it.path).root)
      if (it.sizeBytes > fs.blocks * fs.bsize * RECYCLE_BIN_SHARE) result.push(it)
    } catch {
      result.push(it)
    }
  }
  return result
}

// Actualiza el árbol en memoria para no tener que re-escanear todo después de borrar.
function applyToTree(scan: ScanResult, items: ResolvedItem[], report: DeletionReport): void {
  const isCold = createColdPolicy(scan.coldDays)
  const trashed = report.outcomes.filter((o) => o.status === 'trashed')

  for (const outcome of trashed) {
    const item = items.find((it) => it.path === outcome.path)
    if (!item) continue
    if (item.kind === 'folder') removeFolder(scan.root, item.path)
    else if (item.entry) removeFile(scan.root, item.path, item.sizeBytes, isCold(item.entry))
  }

  // Sacamos de los rankings los archivos borrados y los que estaban dentro de carpetas borradas.
  const gone = trashed.map((o) => normalizeWinPath(o.path))
  const stillExists = (f: FileEntry) => {
    const p = normalizeWinPath(f.path)
    return !gone.some((g) => p === g || isInside(p, g))
  }
  scan.biggestFiles = scan.biggestFiles.filter(stillExists)
  scan.biggestColdFiles = scan.biggestColdFiles.filter(stillExists)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 10_000 && value.every((v) => typeof v === 'string')
}

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
