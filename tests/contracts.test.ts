import { describe, expect, it } from 'vitest'
import {
  ActionSchema,
  DemandObjectSchema,
  RawEventSchema,
  SourceSchema,
} from '../src/domain'
import {
  demandSignalRawEventFixture,
  demandSignalSourceFixture,
  normalizeFixtureDemand,
} from '../src/ingestion'

describe('canonical contract validation', () => {
  it('accepts a valid Source', () => {
    expect(SourceSchema.parse(demandSignalSourceFixture)).toEqual(demandSignalSourceFixture)
  })

  it('rejects a Source missing required identity', () => {
    const invalid: Record<string, unknown> = { ...demandSignalSourceFixture }
    delete invalid.id
    expect(SourceSchema.safeParse(invalid).success).toBe(false)
  })

  it('accepts a valid RawEvent', () => {
    expect(RawEventSchema.parse(demandSignalRawEventFixture)).toEqual(
      demandSignalRawEventFixture,
    )
  })

  it('rejects a RawEvent with an invalid payload hash', () => {
    const invalid = { ...demandSignalRawEventFixture, payloadHash: 'not-a-hash' }
    expect(RawEventSchema.safeParse(invalid).success).toBe(false)
  })

  it('accepts the normalized DemandObject', () => {
    const result = normalizeFixtureDemand()
    expect(result.ok).toBe(true)
    if (result.ok) expect(DemandObjectSchema.safeParse(result.value).success).toBe(true)
  })

  it('enforces DemandObject source and raw-event provenance', () => {
    const result = normalizeFixtureDemand()
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const invalid = {
      ...result.value,
      provenance: { ...result.value.provenance, rawEventId: 'event_other' },
    }
    expect(DemandObjectSchema.safeParse(invalid).success).toBe(false)
  })

  it('requires approval for high-risk actions', () => {
    const invalidAction = {
      contractVersion: '1.0',
      id: 'action_fixture_001',
      opportunityId: 'opportunity_fixture_001',
      actionType: 'send_external_message',
      description: 'Would send an external message.',
      status: 'draft',
      riskLevel: 'high',
      requiresApproval: false,
      approvedAt: null,
      approvedBy: null,
      inputReference: null,
      executionReference: null,
      createdAt: '2026-01-15T10:30:00.000Z',
      updatedAt: '2026-01-15T10:30:00.000Z',
    }
    expect(ActionSchema.safeParse(invalidAction).success).toBe(false)
  })
})
