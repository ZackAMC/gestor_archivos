// PRESENTACIONAL: lista de archivos con tamaño y días sin uso.

import type { FileDTO } from '../../../shared/contract.js'
import { formatBytes } from '../../../shared/format.js'

interface Props {
  files: FileDTO[]
  isSelected: (path: string) => boolean
  onToggle: (file: FileDTO) => void
}

export function FileTable({ files, isSelected, onToggle }: Props) {
  if (files.length === 0) return <p className="muted">No hay archivos para mostrar.</p>

  return (
    <table>
      <thead>
        <tr>
          <th className="check" />
          <th className="num">Tamaño</th>
          <th className="num">Días sin uso</th>
          <th>Ruta</th>
        </tr>
      </thead>
      <tbody>
        {files.map((f) => (
          <tr key={f.path}>
            <td className="check">
              <input type="checkbox" checked={isSelected(f.path)} onChange={() => onToggle(f)} />
            </td>
            <td className="num">{formatBytes(f.sizeBytes)}</td>
            <td className="num">{f.daysSinceUsed}</td>
            <td className="name">{f.path}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
