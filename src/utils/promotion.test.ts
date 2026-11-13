import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { PromotionOutcome } from '@prisma/client'

import { decideOutcome } from './promotion'

describe('decisión del motor de promoción (E3-RF-11/12)', () => {
  it('sin MPAA pendientes, promueve', () => {
    assert.equal(decideOutcome(0), PromotionOutcome.PROMOTED)
  })

  it('con 4 MPAA pendientes, promueve', () => {
    assert.equal(decideOutcome(4), PromotionOutcome.PROMOTED)
  })

  it('con 5 MPAA pendientes, deriva al EDTE', () => {
    assert.equal(decideOutcome(5), PromotionOutcome.REFERRED_TO_EDTE)
  })

  it('con 6 MPAA pendientes, deriva al EDTE', () => {
    assert.equal(decideOutcome(6), PromotionOutcome.REFERRED_TO_EDTE)
  })
})
