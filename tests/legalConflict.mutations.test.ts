import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

test('CRM-090: no expone rutas para editar o eliminar actas', () => {
  const routes = readFileSync('src/routes/legalConflict.routes.ts', 'utf8')

  assert.doesNotMatch(routes, /legalConflictRouter\.patch\s*\(/)
  assert.doesNotMatch(routes, /legalConflictRouter\.put\s*\(/)
  assert.doesNotMatch(routes, /legalConflictRouter\.delete\s*\(/)
})

test('CRM-090: las actas se crean bloqueadas', () => {
  const service = readFileSync('src/services/legalConflict.service.ts', 'utf8')

  assert.match(service, /editLocked:\s*true/)
  assert.doesNotMatch(service, /legalConflict\.update\s*\(/)
  assert.doesNotMatch(service, /legalConflict\.delete\s*\(/)
})
