// PRESENTACIONAL: recibe datos y callbacks por props. No llama a la API ni tiene estado.

import type { FolderDTO } from '../../../shared/contract.js'
import { formatBytes, percent } from '../../../shared/format.js'

interface Props {
  parent: FolderDTO
  folders: FolderDTO[]
  onOpen: (folder: FolderDTO) => void
}

export function FolderTable({ parent, folders, onOpen }: Props) {
  if (folders.length === 0) return <p className="muted">Esta carpeta no tiene subcarpetas.</p>

  return (
    <table>
      <thead>
        <tr>
          <th>Nombre</th>
          <th className="num">Tamaño</th>
          <th>% de {parent.name}</th>
          <th className="num">Archivos</th>
          <th>Frío</th>
        </tr>
      </thead>
      <tbody>
        {folders.map((f) => (
          <tr
            key={f.path}
            className={f.hasChildren ? 'clickable' : undefined}
            onClick={f.hasChildren ? () => onOpen(f) : undefined}
            title={f.path}
          >
            <td className="name">📁 {f.name}{f.hasChildren ? ' ›' : ''}</td>
            <td className="num">{formatBytes(f.sizeBytes)}</td>
            <td>
              <Bar value={f.sizeBytes} total={parent.sizeBytes} /> <span className="muted">{percent(f.sizeBytes, parent.sizeBytes)}</span>
            </td>
            <td className="num">{f.fileCount.toLocaleString('es-AR')}</td>
            <td>
              <Bar value={f.coldBytes} total={f.sizeBytes} cold /> <span className="muted">{percent(f.coldBytes, f.sizeBytes)}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Bar({ value, total, cold = false }: { value: number; total: number; cold?: boolean }) {
  const width = total === 0 ? 0 : (value / total) * 100
  return (
    <span className="bar" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <i className={cold ? 'cold' : undefined} style={{ width: `${width}%` }} />
    </span>
  )
}
