import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

async function findTests(directory) {
  const files = []

  async function walk(dir) {
    let entries

    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch (error) {
      if (error.code === 'ENOENT') return
      throw error
    }

    for (const entry of entries) {
      const path = join(dir, entry.name)

      if (entry.isDirectory()) {
        await walk(path)
      } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
        files.push(path)
      }
    }
  }

  await walk(directory)
  return files
}

const tests = [...(await findTests('tests')), ...(await findTests('src'))].sort()

if (tests.length === 0) {
  console.error('No se encontraron archivos de pruebas.')
  process.exit(1)
}

console.log(`Archivos de pruebas encontrados: ${tests.length}`)

const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...tests], {
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
