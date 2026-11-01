// PUNTO DE ENTRADA: escanea una carpeta y muestra un resumen por consola.
// Uso: pnpm scan <ruta> [--days=180]

import { resolve } from 'node:path'
import { NodeFsScanner } from './adapters/scanner/NodeFsScanner.js'
import type { DiskScanner } from './domain/ports/DiskScanner.js'
import type { FileEntry } from './domain/FileEntry.js'
import type { FolderNode } from './domain/FolderNode.js'
import { createColdPolicy, daysSinceUsed } from './domain/services/ColdPolicy.js'
import { FolderTreeBuilder } from './domain/services/FolderTreeBuilder.js'
import { TopList } from './domain/services/TopList.js'

const args = process.argv.slice(2)
const rootArg = args.find((a) => !a.startsWith('--'))
const days = Number(args.find((a) => a.startsWith('--days='))?.split('=')[1] ?? 180)

if (!rootArg || Number.isNaN(days)) {
  console.error('Uso: pnpm scan <ruta> [--days=180]')
  process.exit(1)
}
const root = resolve(rootArg) // normaliza la ruta (barras, "..", etc)

// --- Armado: acá se "enchufan" las piezas. La variable es del tipo del PUERTO. ---
const scanner: DiskScanner = new NodeFsScanner()
const isCold = createColdPolicy(days)
const tree = new FolderTreeBuilder(root, isCold)
const biggestFiles = new TopList<FileEntry>(15, (f) => f.sizeBytes)
const biggestColdFiles = new TopList<FileEntry>(15, (f) => f.sizeBytes)

let errorCount = 0
const start = performance.now()

for await (const event of scanner.scan(root)) {
  if (event.kind === 'error') {
    errorCount++
    continue
  }
  tree.add(event.entry)
  biggestFiles.add(event.entry)
  if (isCold(event.entry)) biggestColdFiles.add(event.entry)

  if (tree.root.fileCount % 5000 === 0) process.stdout.write(`\r  ${tree.root.fileCount} archivos...`)
}

// --- Reporte ---
const seconds = ((performance.now() - start) / 1000).toFixed(1)
const r = tree.root

console.log(`\n\nEscaneado: ${root}`)
console.log(`Archivos: ${r.fileCount} | Total: ${fmt(r.sizeBytes)} | Errores: ${errorCount} | Tiempo: ${seconds}s`)
console.log(`Sin uso hace +${days} días: ${fmt(r.coldBytes)} (${pct(r.coldBytes, r.sizeBytes)})\n`)

console.log('Carpetas más pesadas (primer nivel):')
const folders = [...r.children.values()].sort((a, b) => b.sizeBytes - a.sizeBytes).slice(0, 15)
for (const f of folders) printFolder(f)

console.log('\nArchivos más pesados:')
for (const f of biggestFiles.values()) printFile(f)

console.log(`\nArchivos fríos más pesados (+${days} días sin uso):`)
for (const f of biggestColdFiles.values()) printFile(f)

// --- Formato ---
function printFolder(f: FolderNode): void {
  console.log(`  ${fmt(f.sizeBytes).padStart(10)}  ${String(f.fileCount).padStart(7)} arch.  ${pct(f.coldBytes, f.sizeBytes).padStart(5)} frío   ${f.name}`)
}

function printFile(f: FileEntry): void {
  console.log(`  ${fmt(f.sizeBytes).padStart(10)}  ${String(daysSinceUsed(f)).padStart(5)} días   ${f.path}`)
}

function pct(part: number, total: number): string {
  return total === 0 ? '0%' : `${Math.round((part / total) * 100)}%`
}

function fmt(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(1)} ${units[i]}`
}
