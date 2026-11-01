// CONTENEDOR: maneja estado y habla con `window.api`. No sabe de tablas ni de estilos.

import { useEffect, useState } from 'react'
import type {
  DeleteResultDTO,
  DeletionPlanDTO,
  FileDTO,
  FolderDTO,
  ScanSummaryDTO,
  SelectionItemDTO,
} from '../../shared/contract.js'
import { formatBytes, percent } from '../../shared/format.js'
import { DeletionPanel } from './components/DeletionPanel.js'
import { DeletionResult } from './components/DeletionResult.js'
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

  // Map por ruta: tildar y destildar es O(1) y no hay duplicados.
  const [selection, setSelection] = useState<Map<string, SelectionItemDTO>>(new Map())
  const [plan, setPlan] = useState<DeletionPlanDTO | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [report, setReport] = useState<DeleteResultDTO['report'] | null>(null)

  // onProgress devuelve la función de desuscripción: justo lo que useEffect espera como cleanup.
  useEffect(() => window.api.onProgress(setProgress), [])

  // Cada vez que cambia la selección, le pedimos a Main que evalúe el impacto.
  // `cancelled` evita que una respuesta vieja pise una más nueva si tildás rápido.
  useEffect(() => {
    if (selection.size === 0) {
      setPlan(null)
      return
    }
    let cancelled = false
    window.api
      .planDeletion([...selection.values()])
      .then((p) => !cancelled && setPlan(p))
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
    return () => {
      cancelled = true
    }
  }, [selection])

  const isSelected = (path: string) => selection.has(path)

  function toggle(item: SelectionItemDTO) {
    setSelection((prev) => {
      const next = new Map(prev) // estado inmutable: React detecta el cambio por referencia
      if (next.has(item.path)) next.delete(item.path)
      else next.set(item.path, item)
      return next
    })
  }

  const toggleFolder = (f: FolderDTO) => toggle({ path: f.path, name: f.name, sizeBytes: f.sizeBytes, kind: 'folder' })
  const toggleFile = (f: FileDTO) => toggle({ path: f.path, name: f.name, sizeBytes: f.sizeBytes, kind: 'file' })

  function removeFromSelection(path: string) {
    setSelection((prev) => {
      const next = new Map(prev)
      next.delete(path)
      return next
    })
  }

  async function deleteSelected() {
    setDeleting(true)
    setError(null)
    try {
      // Solo mandamos rutas. Main confirma con un diálogo nativo y decide qué se borra.
      const result = await window.api.deleteSelection([...selection.keys()])
      if (!result) return // el usuario canceló

      setSummary(result.summary)
      setReport(result.report)

      // Sacamos de la selección lo borrado y lo que iba incluido. Lo fallido o bloqueado queda a la vista.
      const done = result.report.outcomes.filter((o) => o.status === 'trashed' || o.status === 'covered')
      setSelection((prev) => {
        const next = new Map(prev)
        for (const o of done) next.delete(o.path)
        return next
      })

      await refreshTrail()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleting(false)
    }
  }

  // Después de borrar, los tamaños de las migas están viejos y quizás borraste la carpeta
  // en la que estabas parado: volvemos a la última que todavía existe.
  async function refreshTrail() {
    const fresh = await window.api.folders(trail.map((f) => f.path))
    const cut = fresh.findIndex((f) => f === null)
    const valid = (cut === -1 ? fresh : fresh.slice(0, cut)) as FolderDTO[]
    setTrail(valid)
    const last = valid[valid.length - 1]
    if (last) setChildren(await window.api.children(last.path))
  }

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
      setSelection(new Map()) // la selección vieja pertenece a otro escaneo
      setReport(null)
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

          <h2>Selección para borrar</h2>
          {report && <DeletionResult report={report} onDismiss={() => setReport(null)} />}
          <DeletionPanel
            plan={plan}
            deleting={deleting}
            onRemove={removeFromSelection}
            onClear={() => setSelection(new Map())}
            onDelete={deleteSelected}
          />

          <h2>Carpetas</h2>
          <div className="crumbs">
            {trail.map((f, i) => (
              <span key={f.path}>
                {i > 0 && <span className="sep">›</span>}{' '}
                <button onClick={() => goToCrumb(i)} disabled={i === trail.length - 1}>{f.name}</button>
              </span>
            ))}
          </div>
          <FolderTable
            parent={current}
            folders={children}
            onOpen={openFolder}
            isSelected={isSelected}
            onToggle={toggleFolder}
          />

          <h2>Archivos más pesados</h2>
          <FileTable files={summary.biggestFiles} isSelected={isSelected} onToggle={toggleFile} />

          <h2>Archivos fríos más pesados (+{summary.coldDays} días sin uso)</h2>
          <FileTable files={summary.biggestColdFiles} isSelected={isSelected} onToggle={toggleFile} />
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
