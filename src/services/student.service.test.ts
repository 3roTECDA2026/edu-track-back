import assert from 'node:assert/strict'
import test from 'node:test'

import { getStudentHistory, listStudents } from '@/services/student.service'

test('listStudents returns the enrollment from the requested academic year', async () => {
  const result = await listStudents({
    page: 1,
    limit: 20,
    status: 'all',
    year: 2024,
  })
  const sofia = result.data.find((student) => student.id === '00000000-0000-0000-0000-000000000101')

  assert.ok(sofia)
  assert.equal(sofia.currentSection?.year, 2024)
  assert.equal(sofia.currentSection?.grade, 2)
})

test('getStudentHistory groups seeded student records by year', async () => {
  const history = await getStudentHistory('00000000-0000-0000-0000-000000000101')
  const year2024 = history.find((entry) => entry.year === 2024)

  assert.ok(year2024)
  assert.ok(year2024.sections.some((section) => section.section === '2° A'))
  assert.ok(
    year2024.sections.some((section) =>
      section.teachers.some((teacher) => teacher.lastName === 'Prueba')
    )
  )
  assert.equal(
    year2024.subjects.find((subject) => subject.name === 'Matemática')?.grades?.finalScore,
    8
  )
  assert.ok(year2024.alerts.some((alert) => alert.type === 'HEALTH'))
})
