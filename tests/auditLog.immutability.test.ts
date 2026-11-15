import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const migrationsDir = join(process.cwd(), 'prisma', 'migrations')

const readMigrations = () =>
  readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => ({
      name: entry.name,
      sql: readFileSync(join(migrationsDir, entry.name, 'migration.sql'), 'utf8'),
    }))

test('CRM-095: existe la migración que bloquea UPDATE y DELETE sobre AuditLog', () => {
  const migration = readMigrations().find((m) => m.name.endsWith('_crm095_auditlog_inmutable'))

  assert.ok(migration, 'No se encontró la migración crm095_auditlog_inmutable')
  assert.match(migration.sql, /BEFORE\s+UPDATE\s+OR\s+DELETE\s+ON\s+"AuditLog"/i)
  assert.match(migration.sql, /FOR\s+EACH\s+ROW/i)
  assert.match(migration.sql, /RAISE\s+EXCEPTION/i)
})

test('CRM-095: ninguna migración posterior elimina el bloqueo de AuditLog', () => {
  const migrations = readMigrations()
  const index = migrations.findIndex((m) => m.name.endsWith('_crm095_auditlog_inmutable'))

  assert.notEqual(index, -1, 'No se encontró la migración crm095_auditlog_inmutable')

  for (const migration of migrations.slice(index + 1)) {
    assert.doesNotMatch(
      migration.sql,
      /DROP\s+TRIGGER[^;]*AuditLog/i,
      `La migración ${migration.name} elimina el trigger de AuditLog`
    )
    assert.doesNotMatch(
      migration.sql,
      /DROP\s+FUNCTION[^;]*prevent_audit_log_mutation/i,
      `La migración ${migration.name} elimina la función de bloqueo`
    )
  }
})
