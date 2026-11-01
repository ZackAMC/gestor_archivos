// CASO DE USO: mandar a la Papelera lo que el usuario eligió.
// Vuelve a evaluar el riesgo ACÁ: aunque la UI falle o mande cualquier cosa,
// lo bloqueado NUNCA llega al puerto Trash.

import type { Trash } from '../domain/ports/Trash.js'
import { planDeletion, type DeletionCandidate } from '../domain/services/DeletionPlan.js'

export type OutcomeStatus = 'trashed' | 'blocked' | 'covered' | 'failed'

export interface DeletionOutcome {
  path: string
  sizeBytes: number
  status: OutcomeStatus
  reason: string | null // por qué se salteó o falló
}

export interface DeletionReport {
  outcomes: DeletionOutcome[]
  trashedBytes: number
  failedCount: number
}

export async function deleteSelection(trash: Trash, candidates: DeletionCandidate[]): Promise<DeletionReport> {
  const plan = planDeletion(candidates)
  const outcomes: DeletionOutcome[] = []

  // De a UNO y en orden (no en paralelo): si algo falla, sabemos exactamente qué quedó y qué no.
  for (const item of plan.items) {
    const base = { path: item.path, sizeBytes: item.sizeBytes }

    if (item.risk.level === 'blocked') {
      outcomes.push({ ...base, status: 'blocked', reason: item.risk.category })
      continue
    }
    if (item.coveredBy) {
      outcomes.push({ ...base, status: 'covered', reason: item.coveredBy })
      continue
    }

    try {
      await trash.moveToTrash(item.path)
      outcomes.push({ ...base, status: 'trashed', reason: null })
    } catch (err) {
      // Un fallo NO corta el resto: el archivo en uso de una carpeta no frena a las demás.
      outcomes.push({ ...base, status: 'failed', reason: err instanceof Error ? err.message : String(err) })
    }
  }

  const trashed = outcomes.filter((o) => o.status === 'trashed')
  return {
    outcomes,
    trashedBytes: trashed.reduce((acc, o) => acc + o.sizeBytes, 0),
    failedCount: outcomes.filter((o) => o.status === 'failed').length,
  }
}
