import { describe, expect, it } from 'vitest'
import {
  demandSignalRawEventFixture,
  demandSignalSourceFixture,
  normalizeFixtureDemand,
} from '../src/ingestion'

describe('deterministic fixture path', () => {
  it('produces identical RawEvent to DemandObject output on every run', () => {
    const first = normalizeFixtureDemand()
    const second = normalizeFixtureDemand()

    expect(first).toEqual(second)
    expect(first.ok).toBe(true)
    if (!first.ok) return

    expect(first.value.rawEventId).toBe(demandSignalRawEventFixture.id)
    expect(first.value.sourceId).toBe(demandSignalSourceFixture.id)
    expect(first.value.provenance.accessMethod).toBe('fixture')
    expect(first.value.observedFacts).not.toEqual(first.value.inferences)
  })

  it('does not require secrets or external provider access', () => {
    expect(demandSignalSourceFixture.authMode).toBe('none')
    expect(demandSignalSourceFixture.provider).toBe('session1.fixture')
    expect(demandSignalSourceFixture.capabilityMetadata.synthetic).toBe(true)
    expect(normalizeFixtureDemand().ok).toBe(true)
  })

  it('rejects a fixture event whose provenance points at another source', () => {
    const invalidEvent = {
      ...demandSignalRawEventFixture,
      sourceId: 'source_other_fixture',
    }
    const result = normalizeFixtureDemand(demandSignalSourceFixture, invalidEvent)
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED' },
    })
  })
})
