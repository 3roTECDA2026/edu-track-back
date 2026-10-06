import assert from 'node:assert/strict'
import test from 'node:test'

import { getActiveCycle } from '@/services/cycle.service'
import { createEnrollment } from '@/services/enrollment.service'
import { HttpError } from '@/utils/httpError'

test('createEnrollment rejects a section from a previous cycle', async () => {
  const activeCycle = await getActiveCycle()
  assert.ok(activeCycle)

  await assert.rejects(
    createEnrollment(
      {
        studentId: '00000000-0000-0000-0000-000000000101',
        classSectionId: '00000000-0000-0000-0000-000000000301',
      },
      activeCycle.id,
    ),
    (error: unknown) => error instanceof HttpError && error.status === 409,
  )
})
