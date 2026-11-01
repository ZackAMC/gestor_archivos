import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assessDeletionRisk, worstRisk } from './DeletionRisk.js'
import { planDeletion } from './DeletionPlan.js'

const level = (p: string) => assessDeletionRisk(p).level

test('bloquea rutas críticas del sistema', () => {
  assert.equal(level('C:\\'), 'blocked')
  assert.equal(level('C:\\Windows'), 'blocked')
  assert.equal(level('C:\\Windows\\System32'), 'blocked')
  assert.equal(level('C:\\pagefile.sys'), 'blocked')
  assert.equal(level('C:\\Program Files'), 'blocked')
  assert.equal(level('C:\\Users\\andre'), 'blocked')
  assert.equal(level('C:\\Users\\andre\\AppData'), 'blocked')
  assert.equal(level('F:\\Xbox\\Minecraft Launcher'), 'blocked')
})

test('las excepciones dentro de Windows ganan porque van antes', () => {
  assert.equal(level('C:\\Windows\\Temp'), 'low')
  assert.equal(level('C:\\Windows\\SoftwareDistribution\\Download'), 'medium')
})

test('cachés y dependencias son de riesgo bajo', () => {
  assert.equal(level('C:\\Users\\andre\\AppData\\Local\\npm-cache'), 'low')
  assert.equal(level('F:\\proyectos\\app\\node_modules'), 'low')
  assert.equal(level('C:\\Users\\andre\\AppData\\Local\\Temp'), 'low')
  assert.equal(level('C:\\Users\\andre\\AppData\\Roaming\\Code\\Cache'), 'low')
})

test('datos personales y programas son de riesgo alto', () => {
  assert.equal(level('C:\\Users\\andre\\Documents'), 'high')
  assert.equal(level('C:\\Users\\andre\\OneDrive - Empresa\\x'), 'high')
  assert.equal(level('C:\\Program Files\\NZXT CAM'), 'high')
  assert.equal(level('F:\\proyectos\\app\\.git'), 'high')
})

test('rutas desconocidas son de riesgo medio, nunca bajo', () => {
  assert.equal(level('F:\\cosas\\random'), 'medium')
  assert.equal(assessDeletionRisk('F:\\cosas\\random').category, 'Sin regla conocida')
})

test('acepta barras normales y mayúsculas indistintas', () => {
  assert.equal(level('c:/windows/temp/'), 'low')
})

test('worstRisk elige el más grave', () => {
  assert.equal(worstRisk(['low', 'high', 'medium']), 'high')
  assert.equal(worstRisk([]), null)
})

test('planDeletion no cuenta doble los ítems dentro de otra carpeta elegida', () => {
  const plan = planDeletion([
    { path: 'F:\\proyectos\\app', sizeBytes: 100 },
    { path: 'F:\\proyectos\\app\\node_modules', sizeBytes: 60 },
    { path: 'F:\\proyectos\\app2', sizeBytes: 5 },
  ])
  assert.equal(plan.totalBytes, 105)
  assert.equal(plan.items[1]!.coveredBy, 'F:\\proyectos\\app')
  assert.equal(plan.items[2]!.coveredBy, null) // "app2" NO está dentro de "app"
})

test('planDeletion separa lo bloqueado de lo borrable', () => {
  const plan = planDeletion([
    { path: 'C:\\Windows', sizeBytes: 30 },
    { path: 'C:\\Windows\\Temp', sizeBytes: 2 }, // cubierto por C:\Windows
    { path: 'F:\\proyectos\\app\\node_modules', sizeBytes: 10 },
  ])
  assert.equal(plan.totalBytes, 40)
  assert.equal(plan.deletableBytes, 10)
  assert.equal(plan.blockedCount, 1)
  assert.equal(plan.worstLevel, 'blocked')
})
