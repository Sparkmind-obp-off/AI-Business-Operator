import {
  CONTRACT_VERSION,
  OpportunityEvidenceSchema,
  OpportunitySchema,
  type Opportunity,
} from '../domain'
import { idFromHash, sha256 } from '../ingestion/deterministic'
import { failure, success, type Result } from '../shared/result'
import {
  CreateOpportunityInputSchema,
  OPPORTUNITY_CREATION_VERSION,
  OpportunityRecordSchema,
  OpportunityStatusSchema,
  type CreateOpportunityInput,
  type OpportunityRecord,
  type OpportunityStatus,
} from './contracts'
import type { OpportunityFilter, OpportunityRepository } from './repository'

export interface OpportunityContext {
  requestId: string
  traceId: string
}

export type OpportunityLog = (
  eventName: string,
  fields: { status: string; errorCode?: string; data?: Record<string, unknown> },
) => void

export interface OpportunityServiceOptions {
  repository: OpportunityRepository
  now?: () => string
  log?: OpportunityLog
}

const allowedTransitions: Readonly<Record<OpportunityStatus, readonly OpportunityStatus[]>> = {
  new: ['enriched'],
  enriched: [],
  scored: [],
  qualified: [],
  action_ready: [],
  acted_on: [],
  measured: [],
  learned: [],
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`
}

function hasKnownValue(value: string): boolean {
  return value.trim().toLowerCase() !== 'unknown'
}

function titleFor(input: CreateOpportunityInput): string {
  const { demand } = input
  if (hasKnownValue(demand.topic) && hasKnownValue(demand.market)) {
    return truncate(`${demand.topic} for ${demand.market}`, 240)
  }
  if (hasKnownValue(demand.topic)) return truncate(demand.topic, 240)
  if (hasKnownValue(demand.market)) return truncate(`Opportunity for ${demand.market}`, 240)
  return 'Unspecified evidence-backed opportunity'
}

function offerFor(input: CreateOpportunityInput): string {
  const { demand, intelligence } = input
  const hasClassifiedDemand = intelligence.inferred.signalCategory.value !== 'unknown'
  const hasUsableEvidence = intelligence.inferred.evidenceStrength.value !== 'weak'
  if (!hasClassifiedDemand || !hasUsableEvidence || !hasKnownValue(demand.topic)) return 'unknown'

  const segment = hasKnownValue(demand.market) ? ` for ${demand.market}` : ''
  return truncate(`Potential service addressing ${demand.topic}${segment}; requires validation against linked evidence.`, 2_000)
}

function confidenceValue(level: 'low' | 'moderate' | 'high'): number {
  if (level === 'high') return 0.8
  if (level === 'moderate') return 0.6
  return 0.2
}

export class OpportunityService {
  private readonly repository: OpportunityRepository
  private readonly now: () => string
  private readonly log: OpportunityLog

  constructor(options: OpportunityServiceOptions) {
    this.repository = options.repository
    this.now = options.now ?? (() => new Date().toISOString())
    this.log = options.log ?? (() => undefined)
  }

  async create(input: unknown, context: OpportunityContext): Promise<Result<OpportunityRecord>> {
    const parsed = CreateOpportunityInputSchema.safeParse(input)
    if (!parsed.success) {
      this.log('opportunity.validation_failed', {
        status: 'rejected',
        errorCode: 'VALIDATION_FAILED',
        data: { issueCount: parsed.error.issues.length },
      })
      return failure('VALIDATION_FAILED', 'Opportunity input did not satisfy canonical contracts.')
    }

    const value = parsed.data
    const identityKey = await sha256({
      creationVersion: OPPORTUNITY_CREATION_VERSION,
      demandIds: [value.demand.id].sort(),
      sourceReferences: [{
        sourceId: value.demand.sourceId,
        rawEventId: value.demand.rawEventId,
      }],
    })
    const existing = this.repository.findByIdentity(identityKey)
    if (existing) {
      this.log('opportunity.duplicate_detected', {
        status: existing.opportunity.status,
        data: { opportunityId: existing.opportunity.id, demandIds: existing.opportunity.demandIds },
      })
      return success(existing)
    }

    const timestamp = this.now()
    const opportunityId = idFromHash('opportunity', identityKey)
    const opportunityResult = OpportunitySchema.safeParse({
      contractVersion: CONTRACT_VERSION,
      id: opportunityId,
      demandIds: [value.demand.id],
      title: titleFor(value),
      problemStatement: value.demand.summary,
      offerHypothesis: offerFor(value),
      market: value.demand.market,
      segment: hasKnownValue(value.demand.market) ? value.demand.market : 'unknown',
      status: 'new',
      currentScore: null,
      scoreVersion: null,
      confidence: Math.min(
        value.demand.confidence,
        confidenceValue(value.intelligence.inferred.signalCategory.confidence),
      ),
      evidenceSummary: `Linked evidence: demand ${value.demand.id}, raw event ${value.demand.rawEventId}, source ${value.demand.sourceId}.`,
      recommendedNextAction: 'Review linked evidence and validate the opportunity before scoring.',
      owner: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    if (!opportunityResult.success) {
      this.log('opportunity.validation_failed', {
        status: 'failed',
        errorCode: 'VALIDATION_FAILED',
        data: { demandId: value.demand.id, issueCount: opportunityResult.error.issues.length },
      })
      return failure('VALIDATION_FAILED', 'Opportunity did not satisfy the canonical contract.')
    }

    const evidenceLink = OpportunityEvidenceSchema.parse({
      contractVersion: CONTRACT_VERSION,
      opportunityId,
      demandId: value.demand.id,
      relationshipType: 'primary',
      weight: 1,
      createdAt: timestamp,
    })
    const recordResult = OpportunityRecordSchema.safeParse({
      opportunity: opportunityResult.data,
      evidenceLinks: [evidenceLink],
      sourceReferences: [{
        sourceId: value.intelligence.evidence.sourceReference.sourceId,
        rawEventId: value.intelligence.evidence.sourceReference.rawEventId,
        sourceUrl: value.intelligence.evidence.sourceReference.sourceUrl,
        adapterName: value.intelligence.evidence.sourceReference.adapterName,
        adapterVersion: value.intelligence.evidence.sourceReference.adapterVersion,
        accessMethod: value.intelligence.evidence.sourceReference.accessMethod,
        capturedAt: value.intelligence.evidence.sourceReference.capturedAt,
        publishedAt: value.intelligence.evidence.sourceReference.publishedAt,
      }],
      provenance: {
        ...value.intelligence.provenance,
        transformations: [
          ...value.intelligence.provenance.transformations,
          `${OPPORTUNITY_CREATION_VERSION}: deterministic opportunity creation`,
        ],
      },
      lifecycleHistory: [{
        opportunityId,
        fromStatus: null,
        toStatus: 'new',
        reason: 'Created from validated canonical demand and intelligence.',
        occurredAt: timestamp,
      }],
      identityKey,
      creationVersion: OPPORTUNITY_CREATION_VERSION,
    })
    if (!recordResult.success) {
      return failure('VALIDATION_FAILED', 'Opportunity record did not satisfy its contract.')
    }

    this.repository.save(recordResult.data)
    this.log('opportunity.created', {
      status: 'new',
      data: {
        opportunityId,
        demandIds: recordResult.data.opportunity.demandIds,
        sourceId: value.demand.sourceId,
        rawEventId: value.demand.rawEventId,
      },
    })
    void context
    return success(recordResult.data)
  }

  getById(id: string): Result<OpportunityRecord> {
    const record = this.repository.findById(id)
    return record
      ? success(record)
      : failure('NOT_FOUND', 'Opportunity was not found.')
  }

  list(filter: OpportunityFilter = {}): OpportunityRecord[] {
    return this.repository.list(filter)
  }

  transition(
    id: string,
    targetStatusInput: unknown,
    reason: string,
    context: OpportunityContext,
  ): Result<OpportunityRecord> {
    const target = OpportunityStatusSchema.safeParse(targetStatusInput)
    if (!target.success || reason.trim().length === 0 || reason.length > 500) {
      this.log('opportunity.transition_rejected', {
        status: 'rejected',
        errorCode: 'VALIDATION_FAILED',
        data: { opportunityId: id },
      })
      return failure('VALIDATION_FAILED', 'Lifecycle transition input is invalid.')
    }

    const record = this.repository.findById(id)
    if (!record) return failure('NOT_FOUND', 'Opportunity was not found.')

    const fromStatus = record.opportunity.status
    if (!allowedTransitions[fromStatus].includes(target.data)) {
      this.log('opportunity.transition_rejected', {
        status: 'rejected',
        errorCode: 'VALIDATION_FAILED',
        data: { opportunityId: id, fromStatus, toStatus: target.data },
      })
      return failure('VALIDATION_FAILED', `Transition from ${fromStatus} to ${target.data} is not allowed in Phase 4.`)
    }

    const timestamp = this.now()
    const updatedOpportunity: Opportunity = {
      ...record.opportunity,
      status: target.data,
      updatedAt: timestamp,
    }
    const updatedResult = OpportunityRecordSchema.safeParse({
      ...record,
      opportunity: updatedOpportunity,
      lifecycleHistory: [...record.lifecycleHistory, {
        opportunityId: id,
        fromStatus,
        toStatus: target.data,
        reason: reason.trim(),
        occurredAt: timestamp,
      }],
    })
    if (!updatedResult.success) {
      return failure('VALIDATION_FAILED', 'Updated opportunity did not satisfy its contract.')
    }

    this.repository.save(updatedResult.data)
    this.log('opportunity.lifecycle_transitioned', {
      status: target.data,
      data: { opportunityId: id, fromStatus, toStatus: target.data },
    })
    void context
    return success(updatedResult.data)
  }
}
