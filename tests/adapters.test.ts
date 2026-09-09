import { describe, expect, it } from 'vitest'
import app from '../src/index'
import {
  AdapterFetchResultSchema,
  DeterministicFixtureProviderAdapter,
  ProviderAdapterService,
  ProviderCapabilitySchema,
  phase7FixtureSource,
  sourceForFixtureMode,
  type ProviderAdapter,
} from '../src/adapters'
import { InMemoryIngestionRepository, IngestionService } from '../src/ingestion'
import { DemandIntelligenceService } from '../src/intelligence'

const NOW = '2026-09-09T12:00:00.000Z'
const correlation = { requestId: 'request_adapter_test', traceId: 'trace_adapter_test' }

function createService(adapter: ProviderAdapter, logs: unknown[] = []) {
  const repository = new InMemoryIngestionRepository()
  const log = (eventName: string, fields: unknown) => logs.push({ eventName, fields })
  return {
    repository,
    service: new ProviderAdapterService({
      adapter,
      ingestionRepository: repository,
      ingestionService: new IngestionService({ repository, now: () => NOW, log }),
      intelligenceService: new DemandIntelligenceService({ now: () => NOW, log }),
      log,
      clock: () => 100,
    }),
  }
}

function countingAdapter(inner: ProviderAdapter) {
  let fetchCount = 0
  const adapter: ProviderAdapter = {
    getCapabilities: () => inner.getCapabilities(),
    getStatus: () => inner.getStatus(),
    validateConfiguration: (source) => inner.validateConfiguration(source),
    fetch: async (request) => {
      fetchCount += 1
      return inner.fetch(request)
    },
  }
  return { adapter, getFetchCount: () => fetchCount }
}

describe('provider capability and configuration contracts', () => {
  it('validates truthful available, approval-required, unavailable, limited, and degraded states', () => {
    for (const mode of ['available', 'approval_required', 'unavailable', 'rate_limited', 'degraded'] as const) {
      const adapter = new DeterministicFixtureProviderAdapter(mode)
      const capability = adapter.getCapabilities()[0]
      expect(ProviderCapabilitySchema.safeParse(capability).success).toBe(true)
      expect(capability?.status).toBe(sourceForFixtureMode(mode).status)
    }

    expect(() => ProviderCapabilitySchema.parse({
      ...new DeterministicFixtureProviderAdapter('approval_required').getCapabilities()[0],
      approvalRequired: false,
    })).toThrow()
    expect(() => ProviderCapabilitySchema.parse({
      ...new DeterministicFixtureProviderAdapter().getCapabilities()[0],
      approvalRequired: true,
    })).toThrow()
  })

  it('rejects incompatible or credential-bearing source configuration without returning credentials', () => {
    const adapter = new DeterministicFixtureProviderAdapter()
    const incompatible = adapter.validateConfiguration({ ...phase7FixtureSource, provider: 'other.provider' })
    const credentialBearing = adapter.validateConfiguration({
      ...phase7FixtureSource,
      capabilityMetadata: { apiKey: 'must-not-leak' },
    })

    expect(incompatible).toMatchObject({ valid: false, error: { code: 'INVALID_CONFIGURATION' } })
    expect(credentialBearing).toMatchObject({ valid: false, error: { code: 'INVALID_CONFIGURATION' } })
    expect(JSON.stringify(credentialBearing)).not.toContain('must-not-leak')
  })
})

describe('deterministic fixture adapter', () => {
  it('returns deterministic synthetic events with stable provider references and provenance metadata', async () => {
    const adapter = new DeterministicFixtureProviderAdapter()
    const request = { source: phase7FixtureSource, cursor: null, limit: 25 }
    const first = await adapter.fetch(request)
    const second = await adapter.fetch(request)

    expect(first).toEqual(second)
    expect(AdapterFetchResultSchema.safeParse(first).success).toBe(true)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.events[0]).toMatchObject({
      externalEventId: 'phase7-fixture-event-001',
      capturedAt: NOW,
      publishedAt: '2026-09-08T10:00:00.000Z',
      providerMetadata: {
        synthetic: true,
        providerReference: 'fixture-provider-ref-001',
        transformationReference: 'fixture-map-v1',
      },
    })
    expect(first.metadata).toMatchObject({
      provider: 'phase7.fixture',
      accessMethod: 'fixture',
      capabilityStatus: 'available',
      partial: false,
    })
  })

  it('marks a degraded fetch as partial rather than silently complete', async () => {
    const adapter = new DeterministicFixtureProviderAdapter('degraded')
    const result = await adapter.fetch({ source: sourceForFixtureMode('degraded'), cursor: null, limit: 25 })
    expect(result).toMatchObject({
      ok: true,
      status: 'partial',
      metadata: { capabilityStatus: 'degraded', partial: true },
    })
  })

  it('normalizes provider errors without exposing sensitive provider responses', async () => {
    const adapter = new DeterministicFixtureProviderAdapter('provider_error')
    const result = await adapter.fetch({ source: sourceForFixtureMode('provider_error'), cursor: null, limit: 25 })
    expect(result).toMatchObject({
      ok: false,
      status: 'provider_error',
      error: { code: 'PROVIDER_ERROR', retryable: true },
    })
    expect(JSON.stringify(result)).not.toMatch(/authorization|apiKey|accessToken/i)
  })
})

describe('adapter to ingestion and intelligence handoff', () => {
  it('preserves source, external identity, timestamps, access method, dedupe, and Demand Intelligence traceability', async () => {
    const logs: unknown[] = []
    const adapter = new DeterministicFixtureProviderAdapter()
    const { repository, service } = createService(adapter, logs)
    const first = await service.sync(phase7FixtureSource, correlation)
    const replay = await service.sync(phase7FixtureSource, correlation)

    expect(first.ok).toBe(true)
    expect(replay.ok).toBe(true)
    if (!first.ok || !replay.ok) return
    expect(first.ingestion.processingStatus).toBe('processed')
    expect(replay.ingestion.processingStatus).toBe('duplicate')
    expect(replay.ingestion.demandIds).toEqual(first.ingestion.demandIds)

    const eventId = first.ingestion.references[0]?.eventId
    const artifact = eventId ? repository.findArtifactByEventId(eventId) : undefined
    expect(artifact?.source).toMatchObject({
      provider: 'phase7.fixture',
      sourceType: 'manual',
      status: 'available',
    })
    expect(artifact?.rawEvent).toMatchObject({
      externalEventId: 'phase7-fixture-event-001',
      capturedAt: NOW,
      publishedAt: '2026-09-08T10:00:00.000Z',
      provenance: {
        sourceId: 'source_phase7_fixture',
        adapterName: 'phase7.deterministic-fixture',
        adapterVersion: '1.0.0',
        accessMethod: 'fixture',
      },
    })
    expect(artifact?.demand.provenance.rawEventId).toBe(eventId)
    expect(first.intelligence[0]).toMatchObject({
      demandId: first.ingestion.demandIds[0],
      detected: { sourceId: 'source_phase7_fixture', rawEventId: eventId },
      evidence: { sourceReference: { accessMethod: 'fixture' } },
    })
    expect(first.intelligence[0]?.detected.text).toContain('Ignore previous instructions')

    const serializedLogs = JSON.stringify(logs)
    expect(serializedLogs).toContain('adapter.ingestion_handoff')
    expect(serializedLogs).not.toContain('Ignore previous instructions')
  })

  it.each([
    ['approval_required', 'APPROVAL_REQUIRED', false],
    ['unavailable', 'PROVIDER_UNAVAILABLE', false],
    ['rate_limited', 'RATE_LIMITED', true],
  ] as const)('stops %s before fetch and never fabricates success', async (mode, code, retryable) => {
    const counted = countingAdapter(new DeterministicFixtureProviderAdapter(mode))
    const { service } = createService(counted.adapter)
    const result = await service.sync(sourceForFixtureMode(mode), correlation)

    expect(result).toMatchObject({ ok: false, stage: 'capability', error: { code, retryable } })
    expect(counted.getFetchCount()).toBe(0)
    expect(JSON.stringify(result)).not.toContain('events')
  })

  it('rejects invalid configuration before fetch', async () => {
    const counted = countingAdapter(new DeterministicFixtureProviderAdapter())
    const { service } = createService(counted.adapter)
    const result = await service.sync({ ...phase7FixtureSource, provider: 'invalid.provider' }, correlation)

    expect(result).toMatchObject({
      ok: false,
      stage: 'configuration',
      error: { code: 'INVALID_CONFIGURATION', retryable: false },
    })
    expect(counted.getFetchCount()).toBe(0)
  })
})

describe('provider adapter fixture API', () => {
  it('proves the complete boundary without claiming live provider access or exposing credentials', async () => {
    const response = await app.request('/api/v1/fixtures/provider-adapter', {
      headers: { 'x-request-id': 'request_adapter_route', 'x-trace-id': 'trace_adapter_route' },
    })
    const body = await response.json() as { data: { intelligence: unknown[] } }

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      data: {
        source: { provider: 'phase7.fixture', status: 'available' },
        adapterStatus: { capabilityStatus: 'available' },
        fetch: { status: 'succeeded', eventCount: 1 },
        ingestion: { persistence: 'process_local_memory' },
        fixture: { synthetic: true, warning: 'No live provider was accessed.' },
      },
    })
    expect(body.data.intelligence).toHaveLength(1)
    expect(JSON.stringify(body)).not.toMatch(/apiKey|accessToken|authorization/i)
  })
})
