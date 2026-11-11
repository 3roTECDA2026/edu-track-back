import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

test('CRM-090: no expone rutas para editar o eliminar actas', () => {
  const routes = readFileSync('src/routes/legalConflict.routes.ts', 'utf8')

  assert.doesNotMatch(
    routes,
    /legalConflictRouter\.(?:patch|put|delete)\s*\(\s*['"`]\/:id['"`]/
  )
})

test('CRM-092: los anexos rechazan modificaciones con 405', () => {
  const routes = readFileSync('src/routes/legalConflict.routes.ts', 'utf8')

  for (const method of ['put', 'patch', 'delete']) {
    assert.ok(
      routes.includes(
        `legalConflictRouter.${method}('/:id/attachments/:attachmentId', rejectAttachmentMutation)`
      ),
      `Falta bloquear ${method.toUpperCase()} en los anexos`
    )
  }

  assert.match(routes, /res\.status\(405\)/)
})

test('CRM-090: las actas se crean bloqueadas', () => {
  const service = readFileSync('src/services/legalConflict.service.ts', 'utf8')

  assert.match(service, /editLocked:\s*true/)
  assert.doesNotMatch(service, /legalConflict\.update\s*\(/)
  assert.doesNotMatch(service, /legalConflict\.delete\s*\(/)
})
