import type { Source } from '../domain'
import { sha256, type IngestionRepository, type IngestionResponse, type IngestionService } from '../ingestion'
import type { DemandIntelligenceResult, DemandIntelligenceService } from '../intelligence'
import type { CorrelationContext } from '../shared/logger'
import type {
  AdapterFetchFailureSchema,
  AdapterFetchResult,
  ProviderAdapter,
} from './contracts'
import type { z } from 'zod'

type AdapterFetchFailure = z.infer<typeof AdapterFetchFailureSchema>

export type AdapterLog = (
  eventName: string,
  fields: {
    status: string
    durationMs?: number
    errorCode?: string
    data?: Record<string, unknown>
  },
) => void

export interface AdapterSyncSuccess {
  ok: true
  source: Source
  fetch: Extract<AdapterFetchResult, { ok: true }>
  ingestion: IngestionResponse
  intelligence: DemandIntelligenceResult[]
}

export interface AdapterSyncFailure {
  ok: false
  stage: 'configuration' | 'capability' | 'fetch' | 'ingestion' | 'intelligence'
  error: {
    code: string
    message: string
    retryable: boolean
  }
  fetch?: AdapterFetchFailure
}

export type AdapterSyncResult = AdapterSyncSuccess | AdapterSyncFailure

export interface ProviderAdapterServiceOptions {
  adapter: ProviderAdapter
  ingestionService: IngestionService
  ingestionRepository: IngestionRepository
  intelligenceService: DemandIntelligenceService
  log?: AdapterLog
  clock?: () => number
}

export class ProviderAdapterService {
  private readonly adapter: ProviderAdapter
  private readonly ingestionService: IngestionService
  private readonly ingestionRepository: IngestionRepository
  private readonly intelligenceService: DemandIntelligenceService
  private readonly log: AdapterLog
  private readonly clock: () => number

  constructor(options: ProviderAdapterServiceOptions) {
    this.adapter = options.adapter
    this.ingestionService = options.ingestionService
    this.ingestionRepository = options.ingestionRepository
    this.intelligenceService = options.intelligenceService
    this.log = options.log ?? (() => undefined)
    this.clock = options.clock ?? Date.now
  }

  async sync(sourceInput: unknown, correlation: CorrelationContext): Promise<AdapterSyncResult> {
    const startedAt = this.clock()
    const capabilities = this.adapter.getCapabilities()
    const status = this.adapter.getStatus()

    this.log('adapter.capability_checked', {
      status: status.capabilityStatus,
      data: {
        provider: status.provider,
        adapterName: status.adapterName,
        adapterVersion: status.adapterVersion,
        capabilityCount: capabilities.length,
      },
    })

    const validation = this.adapter.validateConfiguration(sourceInput)
    if (!validation.valid || !validation.source) {
      this.log('adapter.configuration_validated', {
        status: 'rejected',
        errorCode: 'INVALID_CONFIGURATION',
        data: { provider: status.provider, adapterName: status.adapterName },
      })
      return {
        ok: false,
        stage: 'configuration',
        error: {
          code: 'INVALID_CONFIGURATION',
          message: validation.error?.message ?? 'Adapter configuration is invalid.',
          retryable: false,
        },
      }
    }

    const source = validation.source
    this.log('adapter.configuration_validated', {
      status: 'valid',
      data: { provider: source.provider, sourceId: source.id, adapterName: status.adapterName },
    })

    if (status.capabilityStatus === 'approval_required') {
      this.log('adapter.approval_required', {
        status: 'approval_required',
        errorCode: 'APPROVAL_REQUIRED',
        data: { provider: source.provider, sourceId: source.id, adapterName: status.adapterName },
      })
      return {
        ok: false,
        stage: 'capability',
        error: {
          code: 'APPROVAL_REQUIRED',
          message: 'Provider access requires approval before fetch.',
          retryable: false,
        },
      }
    }

    if (status.capabilityStatus === 'unavailable' || status.availability === 'unavailable') {
      this.log('adapter.unavailable', {
        status: 'unavailable',
        errorCode: 'PROVIDER_UNAVAILABLE',
        data: { provider: source.provider, sourceId: source.id, adapterName: status.adapterName },
      })
      return {
        ok: false,
        stage: 'capability',
        error: {
          code: 'PROVIDER_UNAVAILABLE',
          message: 'Provider access is unavailable.',
          retryable: false,
        },
      }
    }

    if (status.rateLimit.limited) {
      this.log('adapter.rate_limited', {
        status: 'rate_limited',
        errorCode: 'RATE_LIMITED',
        data: {
          provider: source.provider,
          sourceId: source.id,
          adapterName: status.adapterName,
          retryAfterSeconds: status.rateLimit.retryAfterSeconds,
        },
      })
      return {
        ok: false,
        stage: 'capability',
        error: {
          code: 'RATE_LIMITED',
          message: 'Provider rate limit reached; no bypass attempted.',
          retryable: true,
        },
      }
    }

    this.log('adapter.fetch_started', {
      status: 'started',
      data: { provider: source.provider, sourceId: source.id, adapterName: status.adapterName },
    })
    const fetchResult = await this.adapter.fetch({ source, cursor: null, limit: 25 })

    if (!fetchResult.ok) {
      const eventName = fetchResult.status === 'rate_limited'
        ? 'adapter.rate_limited'
        : fetchResult.status === 'approval_required'
          ? 'adapter.approval_required'
          : fetchResult.status === 'unavailable'
            ? 'adapter.unavailable'
            : 'adapter.fetch_failed'
      this.log(eventName, {
        status: fetchResult.status,
        durationMs: this.clock() - startedAt,
        errorCode: fetchResult.error.code,
        data: {
          provider: source.provider,
          sourceId: source.id,
          adapterName: status.adapterName,
          retryable: fetchResult.error.retryable,
        },
      })
      return { ok: false, stage: 'fetch', error: fetchResult.error, fetch: fetchResult }
    }

    this.log(fetchResult.status === 'partial' ? 'adapter.fetch_partial' : 'adapter.fetch_succeeded', {
      status: fetchResult.status,
      durationMs: this.clock() - startedAt,
      data: {
        provider: source.provider,
        sourceId: source.id,
        adapterName: status.adapterName,
        eventCount: fetchResult.events.length,
        partial: fetchResult.metadata.partial,
      },
    })

    if (fetchResult.events.length === 0) {
      return {
        ok: false,
        stage: 'fetch',
        error: {
          code: 'PROVIDER_ERROR',
          message: 'Adapter returned no events for the deterministic proof path.',
          retryable: false,
        },
      }
    }

    const fingerprint = await sha256({
      sourceId: source.id,
      adapterName: status.adapterName,
      externalEventIds: fetchResult.events.map((event) => event.externalEventId ?? null),
    })
    const ingestion = await this.ingestionService.ingest({
      source: {
        id: source.id,
        provider: source.provider,
        sourceType: source.sourceType,
        displayName: source.displayName,
        status: source.status,
        capabilities: source.capabilities,
        authMode: source.authMode,
        termsReference: source.termsReference,
        adapter: {
          name: status.adapterName,
          version: status.adapterVersion,
          accessMethod: fetchResult.metadata.accessMethod,
        },
        providerMetadata: {
          ...source.capabilityMetadata,
          capabilityStatus: fetchResult.metadata.capabilityStatus,
          partial: fetchResult.metadata.partial,
        },
      },
      events: fetchResult.events,
    }, {
      ...correlation,
      idempotencyKey: `adapter-${fingerprint.slice(7, 47)}`,
    })

    if (!ingestion.ok) {
      this.log('adapter.fetch_failed', {
        status: 'ingestion_failed',
        errorCode: ingestion.error.code,
        data: { provider: source.provider, sourceId: source.id, adapterName: status.adapterName },
      })
      return {
        ok: false,
        stage: 'ingestion',
        error: { ...ingestion.error, retryable: false },
      }
    }

    this.log('adapter.ingestion_handoff', {
      status: ingestion.value.processingStatus,
      data: {
        provider: source.provider,
        sourceId: source.id,
        adapterName: status.adapterName,
        eventCount: ingestion.value.references.length,
      },
    })

    const intelligence: DemandIntelligenceResult[] = []
    for (const reference of ingestion.value.references) {
      const artifact = this.ingestionRepository.findArtifactByEventId(reference.eventId)
      if (!artifact) {
        return {
          ok: false,
          stage: 'intelligence',
          error: {
            code: 'NOT_FOUND',
            message: 'Ingested artifact was not available for Demand Intelligence.',
            retryable: false,
          },
        }
      }
      const analyzed = this.intelligenceService.analyze(artifact.demand, correlation)
      if (!analyzed.ok) {
        return {
          ok: false,
          stage: 'intelligence',
          error: { ...analyzed.error, retryable: false },
        }
      }
      intelligence.push(analyzed.value)
    }

    return { ok: true, source, fetch: fetchResult, ingestion: ingestion.value, intelligence }
  }
}
