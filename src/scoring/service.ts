import { CONTRACT_VERSION, ScoreSchema, type Opportunity } from '../domain'
import { idFromHash, sha256 } from '../ingestion/deterministic'
import { OpportunityRecordSchema, type OpportunityRepository } from '../opportunities'
import { failure, success, type Result } from '../shared/result'
import {
  OPPORTUNITY_SCORING_VERSION,
  ScoreOpportunityInputSchema,
  ScoreRecordSchema,
  type ScoreBand,
  type ScoreComponent,
  type ScoreOpportunityInput,
  type ScoreRecord,
} from './contracts'
import type { ScoreRepository } from './repository'

export const SCORE_WEIGHTS = Object.freeze({
  demandStrength: 25,
  commercialIntent: 20,
  frequency: 15,
  urgency: 10,
  reachability: 10,
  marketGap: 10,
  executionFeasibility: 10,
} as const)

export interface ScoringContext {
  requestId: string
  traceId: string
}

export type ScoringLog = (
  eventName: string,
  fields: { status: string; errorCode?: string; durationMs?: number; data?: Record<string, unknown> },
) => void

export interface OpportunityScoringServiceOptions {
  opportunityRepository: OpportunityRepository
  scoreRepository: ScoreRepository
  now?: () => string
  clockMs?: () => number
  log?: ScoringLog
}

const levelModifier = { high: 1, moderate: 0.8, low: 0.5 } as const
const freshnessModifier = { fresh: 1, aging: 0.75, stale: 0.4, invalid_future: 0 } as const
const evidenceValue = { strong: 1, moderate: 0.65, weak: 0.25 } as const
const commercialValue = { strong: 1, possible: 0.6, none: 0, unknown: 0 } as const
const recurrenceValue = { repeated: 1, single: 0.25, unknown: 0 } as const
const urgencyValue = { immediate: 1, time_bound: 0.65, unknown: 0 } as const
const reachabilityValue = { public_business_channel: 1, source_reply: 0.7, unknown: 0, not_permitted: 0 } as const

function round(value: number, places = 2): number {
  const factor = 10 ** places
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function scoreBandFor(totalScore: number): ScoreBand {
  if (totalScore >= 80) return 'priority'
  if (totalScore >= 65) return 'strong'
  if (totalScore >= 50) return 'watchlist'
  return 'low'
}

function component(
  dimension: keyof typeof SCORE_WEIGHTS,
  normalizedValue: number,
  evidenceStatus: ScoreComponent['evidenceStatus'],
  confidence: number,
  freshness: number,
  evidenceReferences: string[],
  explanation: string,
): ScoreComponent {
  const weight = SCORE_WEIGHTS[dimension]
  return {
    dimension,
    normalizedValue,
    weight,
    weightedContribution: round(normalizedValue * confidence * freshness * weight),
    evidenceStatus,
    confidenceModifier: confidence,
    freshnessModifier: freshness,
    evidenceReferences,
    explanation,
  }
}

function buildBreakdown(input: ScoreOpportunityInput): ScoreComponent[] {
  const { demand, intelligence } = input
  const inferred = intelligence.inferred
  const freshness = freshnessModifier[inferred.freshness.value]
  const demandReference = `demand:${demand.id}`
  const rawEventReference = `raw_event:${demand.rawEventId}`

  return [
    component(
      'demandStrength',
      evidenceValue[inferred.evidenceStrength.value],
      'derived',
      levelModifier[inferred.evidenceStrength.confidence],
      freshness,
      [demandReference, rawEventReference, 'classification:evidenceStrength', 'classification:freshness'],
      'Bounded by classified evidence strength, classification confidence, and evidence freshness.',
    ),
    component(
      'commercialIntent',
      commercialValue[inferred.commercialIntent.value],
      inferred.commercialIntent.value === 'unknown' ? 'unknown' : 'derived',
      levelModifier[inferred.commercialIntent.confidence],
      freshness,
      [demandReference, 'classification:commercialIntent', 'classification:freshness'],
      inferred.commercialIntent.value === 'unknown'
        ? 'No supported commercial-intent evidence; contribution remains zero.'
        : 'Derived only from the canonical commercial-intent classification.',
    ),
    component(
      'frequency',
      recurrenceValue[inferred.recurrence.value],
      inferred.recurrence.value === 'unknown' ? 'unknown' : 'derived',
      levelModifier[inferred.recurrence.confidence],
      freshness,
      [demandReference, 'classification:recurrence', 'classification:freshness'],
      inferred.recurrence.value === 'unknown'
        ? 'Recurrence is unknown; contribution remains zero.'
        : 'Derived only from the canonical recurrence classification.',
    ),
    component(
      'urgency',
      urgencyValue[inferred.urgency.value],
      inferred.urgency.value === 'unknown' ? 'unknown' : 'derived',
      levelModifier[inferred.urgency.confidence],
      freshness,
      [demandReference, 'classification:urgency', 'classification:freshness'],
      inferred.urgency.value === 'unknown'
        ? 'Urgency is unknown; contribution remains zero.'
        : 'Derived only from the canonical urgency classification.',
    ),
    component(
      'reachability',
      reachabilityValue[demand.contactability],
      demand.contactability === 'unknown' || demand.contactability === 'not_permitted' ? 'unknown' : 'observed',
      demand.contactability === 'unknown' || demand.contactability === 'not_permitted' ? 0 : 1,
      freshness,
      [demandReference, `demand:contactability:${demand.contactability}`],
      demand.contactability === 'not_permitted'
        ? 'Source contact is not permitted; no reachability contribution is assigned.'
        : demand.contactability === 'unknown'
          ? 'Reachability is unknown; contribution remains zero.'
          : 'Uses only the canonical permitted contactability signal.',
    ),
    component(
      'marketGap',
      0,
      'unknown',
      0,
      1,
      [demandReference],
      'No canonical competition or market-gap evidence is available; contribution remains zero.',
    ),
    component(
      'executionFeasibility',
      0,
      'unknown',
      0,
      1,
      [demandReference],
      'No canonical execution-feasibility evidence is available; contribution remains zero.',
    ),
  ]
}

function dimensionsFrom(breakdown: ScoreComponent[]) {
  return Object.fromEntries(breakdown.map((item) => [
    item.dimension,
    round(item.normalizedValue * item.confidenceModifier * item.freshnessModifier * 100),
  ]))
}

function fingerprintInput(input: ScoreOpportunityInput) {
  const { opportunityRecord, demand, intelligence } = input
  return {
    scoreVersion: OPPORTUNITY_SCORING_VERSION,
    opportunityId: opportunityRecord.opportunity.id,
    demandId: demand.id,
    contactability: demand.contactability,
    evidenceLinks: opportunityRecord.evidenceLinks,
    sourceReferences: opportunityRecord.sourceReferences,
    evidenceStrength: intelligence.inferred.evidenceStrength,
    commercialIntent: intelligence.inferred.commercialIntent,
    recurrence: intelligence.inferred.recurrence,
    urgency: intelligence.inferred.urgency,
    freshness: intelligence.inferred.freshness,
  }
}

export class OpportunityScoringService {
  private readonly opportunityRepository: OpportunityRepository
  private readonly scoreRepository: ScoreRepository
  private readonly now: () => string
  private readonly clockMs: () => number
  private readonly log: ScoringLog

  constructor(options: OpportunityScoringServiceOptions) {
    this.opportunityRepository = options.opportunityRepository
    this.scoreRepository = options.scoreRepository
    this.now = options.now ?? (() => new Date().toISOString())
    this.clockMs = options.clockMs ?? (() => Date.now())
    this.log = options.log ?? (() => undefined)
  }

  async score(inputValue: unknown, context: ScoringContext): Promise<Result<ScoreRecord>> {
    const startedAt = this.clockMs()
    const parsed = ScoreOpportunityInputSchema.safeParse(inputValue)
    if (!parsed.success) {
      this.log('opportunity.scoring_validation_failed', {
        status: 'rejected',
        errorCode: 'VALIDATION_FAILED',
        durationMs: this.clockMs() - startedAt,
        data: { issueCount: parsed.error.issues.length },
      })
      return failure('VALIDATION_FAILED', 'Scoring input did not satisfy canonical contracts.')
    }

    const input = parsed.data
    const opportunityId = input.opportunityRecord.opportunity.id
    const current = this.opportunityRepository.findById(opportunityId)
    if (!current) return failure('NOT_FOUND', 'Opportunity was not found.')
    if (current.identityKey !== input.opportunityRecord.identityKey) {
      return failure('VALIDATION_FAILED', 'Scoring input does not match the current Opportunity record.')
    }
    if (current.opportunity.status !== 'enriched' && current.opportunity.status !== 'scored') {
      return failure('VALIDATION_FAILED', 'Opportunity must be enriched before scoring.')
    }

    const inputFingerprint = await sha256(fingerprintInput(input))
    const existing = this.scoreRepository.findByFingerprint(inputFingerprint)
    if (existing) {
      this.log('opportunity.score_reused', {
        status: existing.band,
        durationMs: this.clockMs() - startedAt,
        data: {
          opportunityId,
          scoreId: existing.score.id,
          scoringVersion: existing.score.scoreVersion,
          finalScore: existing.score.totalScore,
          scoreBand: existing.band,
        },
      })
      void context
      return success(existing)
    }

    const breakdown = buildBreakdown(input)
    const totalScore = round(breakdown.reduce((sum, item) => sum + item.weightedContribution, 0))
    const unadjustedTotal = breakdown.reduce((sum, item) => sum + item.normalizedValue * item.weight, 0)
    const confidence = round(
      breakdown.reduce((sum, item) => sum + item.confidenceModifier * item.freshnessModifier * item.weight, 0) / 100,
      4,
    )
    const timestamp = this.now()
    const scoreId = idFromHash('score', inputFingerprint)
    const band = scoreBandFor(totalScore)
    const score = ScoreSchema.parse({
      contractVersion: CONTRACT_VERSION,
      id: scoreId,
      opportunityId,
      scoreVersion: OPPORTUNITY_SCORING_VERSION,
      totalScore,
      dimensions: dimensionsFrom(breakdown),
      evidenceAdjustment: round(totalScore - unadjustedTotal),
      confidence,
      reasoningSummary: 'Deterministic evidence-backed prioritization score. Unknown dimensions contribute zero; this is not a purchase or revenue guarantee.',
      createdAt: timestamp,
    })
    const record = ScoreRecordSchema.parse({
      score,
      band,
      breakdown,
      evidenceReferences: [
        `opportunity:${opportunityId}`,
        `demand:${input.demand.id}`,
        `raw_event:${input.demand.rawEventId}`,
        `source:${input.demand.sourceId}`,
      ],
      inputFingerprint,
      calculationMetadata: {
        formula: 'sum(normalized_value * confidence_modifier * freshness_modifier * weight)',
        weightTotal: 100,
        deterministic: true,
        guaranteeDisclaimer: 'Prioritization signal only; not a guarantee of purchase, conversion, or revenue.',
      },
    })

    const updatedOpportunity: Opportunity = {
      ...current.opportunity,
      status: 'scored',
      currentScore: totalScore,
      scoreVersion: OPPORTUNITY_SCORING_VERSION,
      recommendedNextAction: 'Review the score breakdown and linked evidence before qualification or action.',
      updatedAt: timestamp,
    }
    const updatedRecordResult = OpportunityRecordSchema.safeParse({
      ...current,
      opportunity: updatedOpportunity,
      lifecycleHistory: current.opportunity.status === 'enriched'
        ? [...current.lifecycleHistory, {
            opportunityId,
            fromStatus: 'enriched',
            toStatus: 'scored',
            reason: `Calculated deterministic score ${scoreId} with ${OPPORTUNITY_SCORING_VERSION}.`,
            occurredAt: timestamp,
          }]
        : current.lifecycleHistory,
    })
    if (!updatedRecordResult.success) {
      return failure('VALIDATION_FAILED', 'Scored Opportunity did not satisfy its canonical contract.')
    }
    this.scoreRepository.save(record)
    this.opportunityRepository.save(updatedRecordResult.data)

    this.log('opportunity.scored', {
      status: band,
      durationMs: this.clockMs() - startedAt,
      data: {
        opportunityId,
        scoreId,
        scoringVersion: OPPORTUNITY_SCORING_VERSION,
        finalScore: totalScore,
        scoreBand: band,
      },
    })
    void context
    return success(record)
  }

  getLatest(opportunityId: string): Result<ScoreRecord> {
    if (!this.opportunityRepository.findById(opportunityId)) {
      return failure('NOT_FOUND', 'Opportunity was not found.')
    }
    const score = this.scoreRepository.findLatestByOpportunityId(opportunityId)
    return score ? success(score) : failure('NOT_FOUND', 'Opportunity score was not found.')
  }

  getHistory(opportunityId: string): Result<ScoreRecord[]> {
    if (!this.opportunityRepository.findById(opportunityId)) {
      return failure('NOT_FOUND', 'Opportunity was not found.')
    }
    return success(this.scoreRepository.listByOpportunityId(opportunityId))
  }
}
