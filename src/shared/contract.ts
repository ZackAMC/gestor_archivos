// CONTRATO entre Main y Renderer: lo ÚNICO que cruza el puente IPC.
// Son solo datos planos (DTO). Nada de Map, clases ni funciones, porque IPC copia los datos.

export const IPC = {
  pickFolder: 'dialog:pick-folder',
  scan: 'scan:start',
  children: 'scan:children',
  progress: 'scan:progress',
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

// La API que el preload expone como `window.api`. Es TODO lo que la UI puede hacer.
export interface DiskAnalyzerApi {
  pickFolder(): Promise<string | null>
  scan(rootPath: string, coldDays: number): Promise<ScanSummaryDTO>
  children(folderPath: string): Promise<FolderDTO[]>
  onProgress(listener: (fileCount: number) => void): () => void // devuelve "desuscribir"
}
