// PRESENTACIONAL: muestra qué pasaría si borrás lo seleccionado. No decide nada:
// el riesgo ya viene calculado desde Main.

import type { DeletionPlanDTO, RiskLevelDTO } from '../../../shared/contract.js'
import { formatBytes } from '../../../shared/format.js'

const LABELS: Record<RiskLevelDTO, string> = {
  blocked: 'Bloqueado',
  high: 'Riesgo alto',
  medium: 'Riesgo medio',
  low: 'Riesgo bajo',
}

interface Props {
  plan: DeletionPlanDTO | null
  onRemove: (path: string) => void
  onClear: () => void
}

export function DeletionPanel({ plan, onRemove, onClear }: Props) {
  if (!plan || plan.items.length === 0) {
    return <p className="muted">Marcá carpetas o archivos con la casilla para ver qué pasaría si los borrás.</p>
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <b>Liberarías {formatBytes(plan.deletableBytes)}</b>
          <span className="muted"> · {plan.items.length} seleccionados</span>
          {plan.worstLevel && <span className={`badge ${plan.worstLevel}`}>Peor caso: {LABELS[plan.worstLevel]}</span>}
        </div>
        <button onClick={onClear}>Limpiar selección</button>
      </div>

      {plan.blockedCount > 0 && (
        <p className="warn">
          {plan.blockedCount} {plan.blockedCount === 1 ? 'ítem está bloqueado' : 'ítems están bloqueados'} y no se van a poder
          borrar desde la app.
        </p>
      )}

      <ul className="plan">
        {plan.items.map((it) => (
          <li key={it.path} className={it.coveredBy ? 'covered' : undefined}>
            <div className="plan-row">
              <span className={`badge ${it.risk.level}`}>{LABELS[it.risk.level]}</span>
              <span className="name">{it.path}</span>
              <span className="num">{formatBytes(it.sizeBytes)}</span>
              <button className="link" onClick={() => onRemove(it.path)} title="Quitar de la selección">✕</button>
            </div>
            <div className="plan-detail">
              <b>{it.risk.category}:</b> {it.risk.consequence}
              {it.coveredBy && <em> Ya va incluido en {it.coveredBy}, así que no suma.</em>}
            </div>
          </li>
        ))}
      </ul>

      <p className="muted small">
        Todavía no se borra nada. En el próximo paso, el borrado va a mandar todo a la Papelera de reciclaje.
      </p>
    </div>
  )
}
