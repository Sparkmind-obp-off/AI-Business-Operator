import {
  CONTRACT_VERSION,
  DemandEvidenceSchema,
  DemandObjectSchema,
  RawEventSchema,
  SourceSchema,
  type DemandEvidence,
  type DemandObject,
  type RawEvent,
  type Source,
} from '../domain'
import { failure, success, type Result } from '../shared/result'
import { type IngestionRequest, type IngestionResponse } from './contracts'
import { idFromHash, normalizeText, sha256 } from './deterministic'
import {
  type IngestionArtifact,
  type IngestionRepository,
  type StoredIngestionOutcome,
} from './repository'

export type IngestionLog = (
  eventName: string,
  fields: { status: string; errorCode?: string; data?: Record<string, unknown> },
) => void

export interface IngestionContext {
  requestId: string
  traceId: string
  idempotencyKey: string
}

export interface IngestionServiceOptions {
  repository: IngestionRepository
  now?: () => string
  log?: IngestionLog
}

const INGESTION_VERSION = 'ingestion-v1'
const NORMALIZATION_VERSION = 'normalization-v1'

function duplicateResponse(
  outcome: StoredIngestionOutcome,
  context: IngestionContext,
): IngestionResponse {
  return {
    requestId: context.requestId,
    traceId: context.traceId,
    processingStatus: 'duplicate',
    acceptedEventIds: [],
    duplicateEventIds: [...new Set([...outcome.acceptedEventIds, ...outcome.duplicateEventIds])],
    demandIds: outcome.demandIds,
    evidenceIds: outcome.evidenceIds,
    references: outcome.references,
    persistence: 'process_local_memory',
  }
}

function toResponse(
  outcome: StoredIngestionOutcome,
  context: IngestionContext,
): IngestionResponse {
  return {
    requestId: context.requestId,
    traceId: context.traceId,
    processingStatus: outcome.acceptedEventIds.length > 0 ? 'processed' : 'duplicate',
    ...outcome,
    persistence: 'process_local_memory',
  }
}

export class IngestionService {
  private readonly repository: IngestionRepository
  private readonly now: () => string
  private readonly log: IngestionLog

  constructor(options: IngestionServiceOptions) {
    this.repository = options.repository
    this.now = options.now ?? (() => new Date().toISOString())
    this.log = options.log ?? (() => undefined)
  }

  async ingest(
    request: IngestionRequest,
    context: IngestionContext,
  ): Promise<Result<IngestionResponse>> {
    const requestFingerprint = await sha256(request)
    const prior = this.repository.findIdempotency(context.idempotencyKey)

    if (prior) {
      if (prior.requestFingerprint !== requestFingerprint) {
        this.log('ingestion.idempotency_conflict', {
          status: 'rejected',
          errorCode: 'IDEMPOTENCY_CONFLICT',
        })
        return failure(
          'IDEMPOTENCY_CONFLICT',
          'The idempotency key was already used for a different request.',
        )
      }

      this.log('ingestion.duplicate_detected', {
        status: 'duplicate',
        data: { duplicateCount: prior.outcome.acceptedEventIds.length },
      })
      return success(duplicateResponse(prior.outcome, context))
    }

    const receivedAt = this.now()
    const sourceResult = SourceSchema.safeParse({
      contractVersion: CONTRACT_VERSION,
      id: request.source.id,
      provider: request.source.provider,
      sourceType: request.source.sourceType,
      displayName: request.source.displayName,
      status: request.source.status,
      capabilities: request.source.capabilities,
      authMode: request.source.authMode,
      capabilityMetadata: request.source.providerMetadata,
      termsReference: request.source.termsReference,
      createdAt: receivedAt,
      updatedAt: receivedAt,
    })

    if (!sourceResult.success) {
      return failure('VALIDATION_FAILED', 'Source did not satisfy the canonical contract.')
    }

    const outcome: StoredIngestionOutcome = {
      acceptedEventIds: [],
      duplicateEventIds: [],
      demandIds: [],
      evidenceIds: [],
      references: [],
    }

    for (const eventInput of request.events) {
      const artifactResult = await this.createArtifact(
        sourceResult.data,
        request.source.adapter,
        eventInput,
        receivedAt,
      )
      if (!artifactResult.ok) {
        this.log('ingestion.normalization_failed', {
          status: 'rejected',
          errorCode: artifactResult.error.code,
        })
        return artifactResult
      }

      const existing = this.repository.findArtifact(artifactResult.value.dedupeKey)
      const artifact = existing ?? artifactResult.value

      if (existing) {
        outcome.duplicateEventIds.push(existing.rawEvent.id)
        this.log('ingestion.duplicate_detected', {
          status: 'duplicate',
          data: { eventId: existing.rawEvent.id },
        })
      } else {
        this.repository.saveArtifact(artifact)
        outcome.acceptedEventIds.push(artifact.rawEvent.id)
        this.log('ingestion.raw_event_accepted', {
          status: 'accepted',
          data: { eventId: artifact.rawEvent.id, sourceId: artifact.rawEvent.sourceId },
        })
        this.log('ingestion.normalization_completed', {
          status: 'normalized',
          data: { eventId: artifact.rawEvent.id, demandId: artifact.demand.id },
        })
      }

      outcome.demandIds.push(artifact.demand.id)
      outcome.evidenceIds.push(artifact.evidence.id)
      outcome.references.push({
        eventId: artifact.rawEvent.id,
        demandId: artifact.demand.id,
        sourceId: artifact.rawEvent.sourceId,
        sourceUrl: artifact.rawEvent.sourceUrl,
        payloadReference: artifact.rawEvent.payloadReference,
      })
    }

    this.repository.saveIdempotency(context.idempotencyKey, {
      requestFingerprint,
      outcome,
    })

    return success(toResponse(outcome, context))
  }

  private async createArtifact(
    source: Source,
    adapter: IngestionRequest['source']['adapter'],
    eventInput: IngestionRequest['events'][number],
    receivedAt: string,
  ): Promise<Result<IngestionArtifact>> {
    const rawText = eventInput.content.text
    const capturedAt = eventInput.capturedAt ?? receivedAt
    const payloadHash = await sha256({
      sourceId: source.id,
      sourceUrl: eventInput.sourceUrl,
      externalEventId: eventInput.externalEventId ?? null,
      capturedAt,
      publishedAt: eventInput.publishedAt ?? null,
      content: { text: rawText, language: eventInput.content.language },
      providerMetadata: eventInput.providerMetadata,
    })
    const externalEventId = eventInput.externalEventId ?? `checksum-${payloadHash.slice(7, 39)}`
    const dedupeKey = eventInput.externalEventId
      ? `${source.id}:external:${eventInput.externalEventId}`
      : `${source.id}:payload:${payloadHash}`
    const identityHash = await sha256(dedupeKey)
    const eventId = idFromHash('event', identityHash)
    const payloadReference = eventInput.payloadReference ?? `memory://raw-events/${eventId}`

    const rawEventResult = RawEventSchema.safeParse({
      contractVersion: CONTRACT_VERSION,
      id: eventId,
      sourceId: source.id,
      externalEventId,
      payloadReference,
      payloadHash,
      sourceUrl: eventInput.sourceUrl,
      capturedAt,
      publishedAt: eventInput.publishedAt ?? null,
      ingestionVersion: INGESTION_VERSION,
      receivedAt,
      processingStatus: 'normalized',
      errorCode: null,
      content: {
        text: rawText,
        language: eventInput.content.language,
        metadata: eventInput.providerMetadata,
      },
      provenance: {
        sourceId: source.id,
        sourceUrl: eventInput.sourceUrl,
        adapterName: adapter.name,
        adapterVersion: adapter.version,
        accessMethod: adapter.accessMethod,
        capturedAt,
        transformations: ['normalize-whitespace-v1'],
      },
    })

    if (!rawEventResult.success) {
      return failure('VALIDATION_FAILED', 'Raw event did not satisfy the canonical contract.')
    }

    const rawEvent = rawEventResult.data
    const normalized = await normalizeRawEvent(rawEvent)
    if (!normalized.ok) return normalized

    return success({
      dedupeKey,
      source,
      rawEvent,
      demand: normalized.value.demand,
      evidence: normalized.value.evidence,
    })
  }
}

export async function normalizeRawEvent(
  rawEventInput: RawEvent,
): Promise<Result<{ demand: DemandObject; evidence: DemandEvidence }>> {
  const rawEventResult = RawEventSchema.safeParse(rawEventInput)
  if (!rawEventResult.success) {
    return failure('VALIDATION_FAILED', 'Raw event did not satisfy the canonical contract.')
  }

  const rawEvent = rawEventResult.data
  const text = normalizeText(rawEvent.content.text)
  const demandId = idFromHash('demand', await sha256({ rawEventId: rawEvent.id, version: NORMALIZATION_VERSION }))
  const evidenceId = idFromHash('evidence', await sha256({ demandId, rawEventId: rawEvent.id }))
  const transformations = [
    ...rawEvent.provenance.transformations,
    `${NORMALIZATION_VERSION}: deterministic structural normalization only`,
  ]

  const demandResult = DemandObjectSchema.safeParse({
    contractVersion: CONTRACT_VERSION,
    id: demandId,
    sourceId: rawEvent.sourceId,
    rawEventId: rawEvent.id,
    sourceUrl: rawEvent.sourceUrl,
    capturedAt: rawEvent.capturedAt,
    publishedAt: rawEvent.publishedAt,
    authorReference: null,
    text,
    summary: text.slice(0, 2_000),
    topic: 'unknown',
    market: 'unknown',
    location: null,
    intentType: 'unknown',
    evidenceStrength: 0,
    commercialIntent: 0,
    urgency: 0,
    recurrence: 'unknown',
    estimatedBudgetSignal: null,
    contactability: 'unknown',
    confidence: 0,
    observedFacts: ['Raw source text was preserved without semantic classification.'],
    inferences: [],
    classificationVersion: NORMALIZATION_VERSION,
    provenance: {
      ...rawEvent.provenance,
      rawEventId: rawEvent.id,
      transformations,
    },
    createdAt: rawEvent.receivedAt,
    updatedAt: rawEvent.receivedAt,
  })

  if (!demandResult.success) {
    return failure('VALIDATION_FAILED', 'Normalized demand did not satisfy the canonical contract.')
  }

  const evidenceResult = DemandEvidenceSchema.safeParse({
    contractVersion: CONTRACT_VERSION,
    id: evidenceId,
    demandId,
    evidenceType: 'source_excerpt',
    reference: rawEvent.payloadReference,
    excerptReference: rawEvent.payloadReference,
    strength: 1,
    capturedAt: rawEvent.capturedAt,
    metadata: {
      rawEventId: rawEvent.id,
      sourceId: rawEvent.sourceId,
      sourceUrl: rawEvent.sourceUrl,
      classificationPerformed: false,
    },
  })

  if (!evidenceResult.success) {
    return failure('VALIDATION_FAILED', 'Demand evidence did not satisfy the canonical contract.')
  }

  return success({ demand: demandResult.data, evidence: evidenceResult.data })
}
