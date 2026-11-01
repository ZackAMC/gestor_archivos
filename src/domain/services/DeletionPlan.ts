// SERVICIO DE DOMINIO: arma el "plan de borrado" a partir de lo que el usuario seleccionó.
// Evalúa el riesgo de cada ítem y evita contar doble cuando elegís una carpeta Y algo de adentro.

import { assessDeletionRisk, normalizeWinPath, worstRisk, type RiskAssessment, type RiskLevel } from './DeletionRisk.js'

export interface DeletionCandidate {
  path: string
  sizeBytes: number
}

export interface PlannedItem extends DeletionCandidate {
  risk: RiskAssessment
  coveredBy: string | null // si una carpeta padre también está elegida, este ítem ya va incluido
}

export interface DeletionPlan {
  items: PlannedItem[]
  totalBytes: number // solo cuenta los ítems que NO están cubiertos por un padre
  deletableBytes: number // igual que totalBytes, pero sin los bloqueados
  worstLevel: RiskLevel | null
  blockedCount: number
}

export function planDeletion(candidates: DeletionCandidate[]): DeletionPlan {
  const normalized = candidates.map((c) => normalizeWinPath(c.path))

  const items: PlannedItem[] = candidates.map((c, i) => {
    const self = normalized[i]!
    const parentIndex = normalized.findIndex((other, j) => j !== i && isInside(self, other))
    return {
      ...c,
      risk: assessDeletionRisk(c.path),
      coveredBy: parentIndex === -1 ? null : candidates[parentIndex]!.path,
    }
  })

  const counted = items.filter((it) => it.coveredBy === null)
  return {
    items,
    totalBytes: sum(counted),
    deletableBytes: sum(counted.filter((it) => it.risk.level !== 'blocked')),
    worstLevel: worstRisk(items.map((it) => it.risk.level)),
    blockedCount: items.filter((it) => it.risk.level === 'blocked').length,
  }
}

// ¿`child` está DENTRO de `parent`? Se compara con separador, así "c:\a" no contiene a "c:\ab".
function isInside(child: string, parent: string): boolean {
  const prefix = parent.endsWith('\\') ? parent : `${parent}\\`
  return child.startsWith(prefix)
}

function sum(items: DeletionCandidate[]): number {
  return items.reduce((acc, it) => acc + it.sizeBytes, 0)
}
