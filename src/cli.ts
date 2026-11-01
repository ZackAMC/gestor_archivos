// ADAPTADOR DE ENTRADA (consola): escanea una carpeta y muestra un resumen.
// Uso: pnpm scan <ruta> [--days=180]

import { resolve } from 'node:path'
import { NodeFsScanner } from './adapters/scanner/NodeFsScanner.js'
import { scanDisk } from './application/ScanDisk.js'
import type { FileEntry } from './domain/FileEntry.js'
import { sortedChildren, type FolderNode } from './domain/FolderNode.js'
import { daysSinceUsed } from './domain/services/ColdPolicy.js'
import { formatBytes as fmt, percent as pct } from './shared/format.js'

const args = process.argv.slice(2)
const rootArg = args.find((a) => !a.startsWith('--'))
const days = Number(args.find((a) => a.startsWith('--days='))?.split('=')[1] ?? 180)

if (!rootArg || Number.isNaN(days)) {
  console.error('Uso: pnpm scan <ruta> [--days=180]')
  process.exit(1)
}
const root = resolve(rootArg) // normaliza la ruta (barras, "..", etc)

const result = await scanDisk(new NodeFsScanner(), root, {
  coldDays: days,
  onProgress: (n) => process.stdout.write(`\r  ${n} archivos...`),
})

// --- Reporte ---
const r = result.root
console.log(`\n\nEscaneado: ${root}`)
console.log(`Archivos: ${r.fileCount} | Total: ${fmt(r.sizeBytes)} | Errores: ${result.errorCount} | Tiempo: ${result.seconds.toFixed(1)}s`)
console.log(`Sin uso hace +${days} días: ${fmt(r.coldBytes)} (${pct(r.coldBytes, r.sizeBytes)})\n`)

console.log('Carpetas más pesadas (primer nivel):')
for (const f of sortedChildren(r).slice(0, 15)) printFolder(f)

console.log('\nArchivos más pesados:')
for (const f of result.biggestFiles) printFile(f)

console.log(`\nArchivos fríos más pesados (+${days} días sin uso):`)
for (const f of result.biggestColdFiles) printFile(f)

function printFolder(f: FolderNode): void {
  console.log(`  ${fmt(f.sizeBytes).padStart(10)}  ${String(f.fileCount).padStart(7)} arch.  ${pct(f.coldBytes, f.sizeBytes).padStart(5)} frío   ${f.name}`)
}

function printFile(f: FileEntry): void {
  console.log(`  ${fmt(f.sizeBytes).padStart(10)}  ${String(daysSinceUsed(f)).padStart(5)} días   ${f.path}`)
}
