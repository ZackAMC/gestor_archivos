// Le dice a TypeScript que `window.api` existe y qué forma tiene.
// La forma sale del MISMO contrato que implementa el preload: si cambia uno, el otro no compila.

import type { DiskAnalyzerApi } from '../../shared/contract.js'

declare global {
  interface Window {
    api: DiskAnalyzerApi
  }
}

export {}
