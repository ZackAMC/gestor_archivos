// PRESENTACIONAL: lista de archivos con tamaño y días sin uso.

import type { FileDTO } from '../../../shared/contract.js'
import { formatBytes } from '../../../shared/format.js'

export function FileTable({ files }: { files: FileDTO[] }) {
  if (files.length === 0) return <p className="muted">No hay archivos para mostrar.</p>

  return (
    <table>
      <thead>
        <tr>
          <th className="num">Tamaño</th>
          <th className="num">Días sin uso</th>
          <th>Ruta</th>
        </tr>
      </thead>
      <tbody>
        {files.map((f) => (
          <tr key={f.path}>
            <td className="num">{formatBytes(f.sizeBytes)}</td>
            <td className="num">{f.daysSinceUsed}</td>
            <td className="name">{f.path}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
