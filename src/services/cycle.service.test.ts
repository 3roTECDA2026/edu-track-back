import assert from 'node:assert/strict'
import test from 'node:test'

import { prisma } from '@/lib/prisma'
import { activateCycle, createCycle, getActiveCycle } from '@/services/cycle.service'

function createUniqueYear(): number {
  return 9000 + Math.floor(Math.random() * 1000)
}

test('activating a cycle deactivates every other cycle atomically', async () => {
  const previousActive = await getActiveCycle()
  const cycle = await createCycle({ year: createUniqueYear(), isActive: false })

  try {
    const activated = await activateCycle(cycle.id)
    const activeCycles = await prisma.academicCycle.findMany({
      where: { isActive: true },
      select: { id: true },
    })

    assert.equal(activated.isActive, true)
    assert.deepEqual(activeCycles.map(({ id }) => id), [cycle.id])
  } finally {
    if (previousActive) await activateCycle(previousActive.id)
    await prisma.academicCycle.delete({ where: { id: cycle.id } })
  }
})

test('cycle date bounds are persisted and active cycles can be retrieved', async () => {
  const year = createUniqueYear()
  const startDate = new Date(`${year}-03-01T00:00:00.000Z`)
  const endDate = new Date(`${year}-12-15T00:00:00.000Z`)
  const cycle = await createCycle({ year, isActive: false, startDate, endDate })

  try {
    const stored = await prisma.academicCycle.findUnique({ where: { id: cycle.id } })
    assert.equal(stored?.startDate?.toISOString(), startDate.toISOString())
    assert.equal(stored?.endDate?.toISOString(), endDate.toISOString())
  } finally {
    await prisma.academicCycle.delete({ where: { id: cycle.id } })
  }
})
