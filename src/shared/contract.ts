// CONTRATO entre Main y Renderer: lo ÚNICO que cruza el puente IPC.
// Son solo datos planos (DTO). Nada de Map, clases ni funciones, porque IPC copia los datos.

export const IPC = {
  pickFolder: 'dialog:pick-folder',
  scan: 'scan:start',
  children: 'scan:children',
  progress: 'scan:progress',
  planDeletion: 'deletion:plan',
  deleteSelection: 'deletion:execute',
  folders: 'scan:folders',
} as const

export interface FolderDTO {
  name: string
  path: string
  sizeBytes: number
  fileCount: number
  coldBytes: number
  hasChildren: boolean
}

export interface FileDTO {
  name: string
  path: string
  sizeBytes: number
  daysSinceUsed: number
}

export interface ScanSummaryDTO {
  root: FolderDTO
  children: FolderDTO[] // solo el primer nivel. El resto se pide bajo demanda.
  biggestFiles: FileDTO[]
  biggestColdFiles: FileDTO[]
  errorCount: number
  seconds: number
  coldDays: number
}

// --- Selección para borrar ---

export type RiskLevelDTO = 'blocked' | 'high' | 'medium' | 'low'

export interface SelectionItemDTO {
  path: string
  name: string
  sizeBytes: number
  kind: 'folder' | 'file'
}

export interface PlannedItemDTO {
  path: string
  sizeBytes: number
  risk: { level: RiskLevelDTO; category: string; consequence: string }
  coveredBy: string | null
}

export interface DeletionPlanDTO {
  items: PlannedItemDTO[]
  totalBytes: number
  deletableBytes: number
  worstLevel: RiskLevelDTO | null
  blockedCount: number
}

export interface DeletionOutcomeDTO {
  path: string
  sizeBytes: number
  status: 'trashed' | 'blocked' | 'covered' | 'failed'
  reason: string | null
}

export interface DeleteResultDTO {
  report: { outcomes: DeletionOutcomeDTO[]; trashedBytes: number; failedCount: number }
  summary: ScanSummaryDTO // los totales ya descontados
}

// La API que el preload expone como `window.api`. Es TODO lo que la UI puede hacer.
export interface DiskAnalyzerApi {
  pickFolder(): Promise<string | null>
  scan(rootPath: string, coldDays: number): Promise<ScanSummaryDTO>
  children(folderPath: string): Promise<FolderDTO[]>
  onProgress(listener: (fileCount: number) => void): () => void // devuelve "desuscribir"
  planDeletion(items: SelectionItemDTO[]): Promise<DeletionPlanDTO>
  // Solo manda RUTAS: los tamaños los saca Main de su propio escaneo.
  // Devuelve null si el usuario canceló en el diálogo de confirmación.
  deleteSelection(paths: string[]): Promise<DeleteResultDTO | null>
  folders(paths: string[]): Promise<(FolderDTO | null)[]> // null = ya no existe en el árbol
}
