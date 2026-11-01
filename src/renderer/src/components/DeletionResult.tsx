// PRESENTACIONAL: qué pasó con el último borrado.

import type { DeleteResultDTO } from '../../../shared/contract.js'
import { formatBytes } from '../../../shared/format.js'

interface Props {
  report: DeleteResultDTO['report']
  onDismiss: () => void
}

export function DeletionResult({ report, onDismiss }: Props) {
  const trashed = report.outcomes.filter((o) => o.status === 'trashed')
  const failed = report.outcomes.filter((o) => o.status === 'failed')
  const blocked = report.outcomes.filter((o) => o.status === 'blocked')

  return (
    <div className={failed.length > 0 ? 'panel result has-errors' : 'panel result'}>
      <div className="panel-head">
        <b>
          {trashed.length} {trashed.length === 1 ? 'ítem enviado' : 'ítems enviados'} a la Papelera · {formatBytes(report.trashedBytes)}{' '}
          liberados
        </b>
        <button onClick={onDismiss}>Cerrar</button>
      </div>

      {failed.length > 0 && (
        <>
          <p className="warn">No se pudieron borrar (probablemente están en uso o sin permisos):</p>
          <ul className="plan">
            {failed.map((o) => (
              <li key={o.path}>
                <span className="name">{o.path}</span> <span className="muted">— {o.reason}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">Si un borrado falló a la mitad, re-escaneá para ver los números exactos.</p>
        </>
      )}

      {blocked.length > 0 && (
        <p className="muted small">{blocked.length} bloqueados se saltearon, como estaba previsto.</p>
      )}

      <p className="muted small">Para recuperar algo, abrí la Papelera de reciclaje y usá "Restaurar".</p>
    </div>
  )
}
