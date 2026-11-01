// CONTENEDOR: maneja estado y habla con `window.api`. No sabe de tablas ni de estilos.

import { useEffect, useState } from 'react'
import type { FolderDTO, ScanSummaryDTO } from '../../shared/contract.js'
import { formatBytes, percent } from '../../shared/format.js'
import { FileTable } from './components/FileTable.js'
import { FolderTable } from './components/FolderTable.js'

export function App() {
  const [rootPath, setRootPath] = useState('')
  const [coldDays, setColdDays] = useState(180)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ScanSummaryDTO | null>(null)
  const [trail, setTrail] = useState<FolderDTO[]>([]) // migas de pan: raíz -> carpeta actual
  const [children, setChildren] = useState<FolderDTO[]>([])

  // onProgress devuelve la función de desuscripción: justo lo que useEffect espera como cleanup.
  useEffect(() => window.api.onProgress(setProgress), [])

  async function pickFolder() {
    const path = await window.api.pickFolder()
    if (path) setRootPath(path)
  }

  async function scan() {
    setScanning(true)
    setError(null)
    setProgress(0)
    try {
      const result = await window.api.scan(rootPath, coldDays)
      setSummary(result)
      setTrail([result.root])
      setChildren(result.children)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setScanning(false)
    }
  }

  async function openFolder(folder: FolderDTO) {
    setChildren(await window.api.children(folder.path))
    setTrail((t) => [...t, folder])
  }

  async function goToCrumb(index: number) {
    const folder = trail[index]
    if (!folder) return
    setChildren(await window.api.children(folder.path))
    setTrail((t) => t.slice(0, index + 1))
  }

  const current = trail[trail.length - 1]
  const validDays = Number.isInteger(coldDays) && coldDays >= 0

  return (
    <>
      <h1>Disk Analyzer</h1>

      <div className="toolbar">
        <button onClick={pickFolder} disabled={scanning}>Elegir carpeta…</button>
        <div className={rootPath ? 'path set' : 'path'}>{rootPath || 'Ninguna carpeta elegida'}</div>
        <label className="muted">
          Frío después de{' '}
          <input type="number" min={0} value={coldDays} onChange={(e) => setColdDays(e.target.valueAsNumber)} /> días
        </label>
        <button className="primary" onClick={scan} disabled={!rootPath || scanning || !validDays}>
          {scanning ? 'Escaneando…' : 'Escanear'}
        </button>
      </div>

      {scanning && <div className="status">{progress.toLocaleString('es-AR')} archivos leídos…</div>}
      {error && <div className="status error">{error}</div>}

      {summary && current && (
        <>
          <div className="stats">
            <Stat label="Total" value={formatBytes(summary.root.sizeBytes)} />
            <Stat label="Archivos" value={summary.root.fileCount.toLocaleString('es-AR')} />
            <Stat
              label={`Sin uso hace +${summary.coldDays} días`}
              value={`${formatBytes(summary.root.coldBytes)} (${percent(summary.root.coldBytes, summary.root.sizeBytes)})`}
            />
            <Stat label="Sin acceso (errores)" value={String(summary.errorCount)} />
            <Stat label="Tiempo" value={`${summary.seconds.toFixed(1)} s`} />
          </div>

          <h2>Carpetas</h2>
          <div className="crumbs">
            {trail.map((f, i) => (
              <span key={f.path}>
                {i > 0 && <span className="sep">›</span>}{' '}
                <button onClick={() => goToCrumb(i)} disabled={i === trail.length - 1}>{f.name}</button>
              </span>
            ))}
          </div>
          <FolderTable parent={current} folders={children} onOpen={openFolder} />

          <h2>Archivos más pesados</h2>
          <FileTable files={summary.biggestFiles} />

          <h2>Archivos fríos más pesados (+{summary.coldDays} días sin uso)</h2>
          <FileTable files={summary.biggestColdFiles} />
        </>
      )}
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  )
}
