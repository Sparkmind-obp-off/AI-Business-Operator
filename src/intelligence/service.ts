import { DemandObjectSchema, type DemandObject } from '../domain'
import { failure, success, type Result } from '../shared/result'
import {
  DemandIntelligenceResultSchema,
  INTELLIGENCE_CLASSIFICATION_VERSION,
  type ConfidenceLevel,
  type DemandIntelligenceResult,
} from './contracts'

export interface IntelligenceContext {
  requestId: string
  traceId: string
}

export type IntelligenceLog = (
  eventName: string,
  fields: { status: string; errorCode?: string; data?: Record<string, unknown> },
) => void

export interface DemandIntelligenceServiceOptions {
  now?: () => string
  log?: IntelligenceLog
}

type SignalCategory = DemandIntelligenceResult['inferred']['signalCategory']['value']
type Intent = DemandIntelligenceResult['inferred']['intent']['value']

interface Classification {
  value: SignalCategory
  basis: string[]
}

const DAY_MS = 86_400_000
export const FRESHNESS_WINDOWS_DAYS = Object.freeze({ fresh: 7, aging: 30 })

const rules: ReadonlyArray<{ category: SignalCategory; patterns: RegExp[] }> = [
  {
    category: 'recurring_workflow_problem',
    patterns: [
      /\b(every\s+(day|week|month)|daily|weekly|monthly|ongoing|repeatedly|constantly)\b/i,
      /\b(workflow|process|task)\b/i,
    ],
  },
  {
    category: 'comparison_request',
    patterns: [/\b(compare|comparison|versus|vs\.?|which|recommend(?:ation)?|best option)\b/i],
  },
  {
    category: 'purchase_intent',
    patterns: [/\b(buy|purchase|order|pricing|price|request (?:a )?quote|need (?:a )?quote)\b/i],
  },
  {
    category: 'job_requirement',
    patterns: [
      /\b(hire|hiring|freelancer|contractor|job requirement|project requirement)\b/i,
      /\b(need|looking for|seeking)\b.{0,50}\b(developer|designer|consultant|agency|specialist|provider)\b/i,
    ],
  },
  {
    category: 'product_gap',
    patterns: [/\b(no (?:tool|product|software)|missing feature|does not support|doesn't support|product gap)\b/i],
  },
  {
    category: 'unmet_service_need',
    patterns: [/\b(cannot find|can't find|no (?:service|provider)|unable to find|unmet need)\b/i],
  },
  {
    category: 'repeated_pain_point',
    patterns: [
      /\b(keeps? (?:failing|breaking|happening)|again and again|repeated problem|recurring issue)\b/i,
    ],
  },
  {
    category: 'commercial_trend',
    patterns: [/\b(growing demand|sales trend|commercial trend|customers increasingly)\b/i],
  },
  {
    category: 'explicit_request',
    patterns: [/\b(need|request(?:s|ing)?|looking for|seeking|can someone|help wanted|want someone)\b/i],
  },
]

const commercialPatterns = [
  /\b(buy|purchase|order|pricing|price|quote|budget)\b/i,
  /\b(hire|hiring|freelancer|contractor|agency|provider|supplier|vendor)\b/i,
]
const immediatePatterns = [/\b(urgent|urgently|asap|immediately|right now|today|within 24 hours?)\b/i]
const timeBoundPatterns = [
  /\b(deadline|this week|this month|by (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow))\b/i,
  /\bby \d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/i,
]
const repeatedPatterns = [
  /\b(every\s+(day|week|month)|daily|weekly|monthly|ongoing|repeatedly|constantly|again and again)\b/i,
  /\b(keeps? (?:failing|breaking|happening)|recurring (?:issue|problem|workflow))\b/i,
]
const singlePatterns = [/\b(one[- ]time|single occurrence|only once)\b/i]
const specificityPatterns = [
  /\b(requirement|must|should include|needs? to|workflow|integration|website|application|service)\b/i,
]

function matches(text: string, patterns: RegExp[]): string[] {
  return patterns.flatMap((pattern) => {
    const match = text.match(pattern)?.[0]
    return match ? [match] : []
  })
}

function classifySignal(text: string): Classification {
  for (const rule of rules) {
    const basis = matches(text, rule.patterns)
    const requiresAll = rule.category === 'recurring_workflow_problem'
    if ((requiresAll && basis.length === rule.patterns.length) || (!requiresAll && basis.length > 0)) {
      return { value: rule.category, basis }
    }
  }
  return { value: 'unknown', basis: [] }
}

function classifyIntent(category: SignalCategory): Intent {
  if (category === 'purchase_intent') return 'purchase'
  if (category === 'job_requirement' || category === 'unmet_service_need') return 'service_project'
  if (category === 'comparison_request') return 'comparison_recommendation'
  if (category === 'explicit_request') return 'informational_request'
  return 'unknown'
}

function confidenceFor(category: SignalCategory, basis: string[]): ConfidenceLevel {
  if (category === 'unknown') return 'low'
  return basis.length > 1 ? 'high' : 'moderate'
}

function evaluateFreshness(demand: DemandObject, evaluatedAt: string) {
  const timestampUsed = demand.publishedAt ? 'publishedAt' as const : 'capturedAt' as const
  const sourceTimestamp = demand.publishedAt ?? demand.capturedAt
  const evaluatedMs = Date.parse(evaluatedAt)
  const sourceMs = Date.parse(sourceTimestamp)
  const ageMs = evaluatedMs - sourceMs

  if (ageMs < 0) {
    return {
      value: 'invalid_future' as const,
      confidence: 'high' as const,
      basis: [`${timestampUsed} is later than evaluatedAt`],
      evaluatedAt,
      timestampUsed,
      ageDays: null,
    }
  }

  const ageDays = Math.floor(ageMs / DAY_MS)
  const value = ageDays <= FRESHNESS_WINDOWS_DAYS.fresh
    ? 'fresh' as const
    : ageDays <= FRESHNESS_WINDOWS_DAYS.aging
      ? 'aging' as const
      : 'stale' as const

  return {
    value,
    confidence: 'high' as const,
    basis: [`${timestampUsed} age is ${ageDays} day(s)`],
    evaluatedAt,
    timestampUsed,
    ageDays,
  }
}

export class DemandIntelligenceService {
  private readonly now: () => string
  private readonly log: IntelligenceLog

  constructor(options: DemandIntelligenceServiceOptions = {}) {
    this.now = options.now ?? (() => new Date().toISOString())
    this.log = options.log ?? (() => undefined)
  }

  analyze(demandInput: unknown, context: IntelligenceContext): Result<DemandIntelligenceResult> {
    const parsed = DemandObjectSchema.safeParse(demandInput)
    if (!parsed.success) {
      this.log('intelligence.validation_failed', {
        status: 'rejected',
        errorCode: 'VALIDATION_FAILED',
        data: { issueCount: parsed.error.issues.length },
      })
      return failure('VALIDATION_FAILED', 'DemandObject did not satisfy the canonical contract.')
    }

    const demand = parsed.data
    this.log('intelligence.received', {
      status: 'received',
      data: { demandId: demand.id, sourceId: demand.sourceId, rawEventId: demand.rawEventId },
    })

    const signal = classifySignal(demand.text)
    const signalConfidence = confidenceFor(signal.value, signal.basis)
    const intent = classifyIntent(signal.value)
    const commercialBasis = matches(demand.text, commercialPatterns)
    const commercialIntent = commercialBasis.length > 0
      ? (signal.value === 'purchase_intent' || signal.value === 'job_requirement' ? 'strong' as const : 'possible' as const)
      : (signal.value === 'unknown' ? 'unknown' as const : 'none' as const)
    const urgencyBasis = matches(demand.text, immediatePatterns)
    const timeBoundBasis = matches(demand.text, timeBoundPatterns)
    const urgency = urgencyBasis.length > 0 ? 'immediate' as const : timeBoundBasis.length > 0 ? 'time_bound' as const : 'unknown' as const
    const recurrenceBasis = matches(demand.text, repeatedPatterns)
    const singleBasis = matches(demand.text, singlePatterns)
    const recurrence = recurrenceBasis.length > 0 ? 'repeated' as const : singleBasis.length > 0 ? 'single' as const : 'unknown' as const
    const specificityBasis = matches(demand.text, specificityPatterns)
    const evidenceStrength = signal.value === 'unknown'
      ? 'weak' as const
      : commercialBasis.length > 0 && specificityBasis.length > 0
        ? 'strong' as const
        : 'moderate' as const
    const evidenceConfidence: ConfidenceLevel = evidenceStrength === 'strong' ? 'high' : evidenceStrength === 'moderate' ? 'moderate' : 'low'
    const evaluatedAt = this.now()
    const freshness = evaluateFreshness(demand, evaluatedAt)

    const classificationReferences = [
      ...signal.basis.map((matchedText) => ({ attribute: 'signalCategory', matchedText })),
      ...commercialBasis.map((matchedText) => ({ attribute: 'commercialIntent', matchedText })),
      ...[...urgencyBasis, ...timeBoundBasis].map((matchedText) => ({ attribute: 'urgency', matchedText })),
      ...[...recurrenceBasis, ...singleBasis].map((matchedText) => ({ attribute: 'recurrence', matchedText })),
      ...specificityBasis.map((matchedText) => ({ attribute: 'evidenceStrength', matchedText })),
    ]

    const result = DemandIntelligenceResultSchema.safeParse({
      classificationVersion: INTELLIGENCE_CLASSIFICATION_VERSION,
      demandId: demand.id,
      detected: {
        sourceId: demand.sourceId,
        rawEventId: demand.rawEventId,
        sourceUrl: demand.sourceUrl,
        text: demand.text,
        capturedAt: demand.capturedAt,
        publishedAt: demand.publishedAt,
      },
      inferred: {
        signalCategory: { value: signal.value, confidence: signalConfidence, basis: signal.basis },
        intent: { value: intent, confidence: signalConfidence, basis: signal.basis },
        evidenceStrength: {
          value: evidenceStrength,
          confidence: evidenceConfidence,
          basis: [...signal.basis, ...commercialBasis, ...specificityBasis],
        },
        commercialIntent: {
          value: commercialIntent,
          confidence: commercialBasis.length > 0 ? 'high' : signal.value === 'unknown' ? 'low' : 'moderate',
          basis: commercialBasis,
        },
        urgency: {
          value: urgency,
          confidence: urgency === 'unknown' ? 'low' : 'high',
          basis: [...urgencyBasis, ...timeBoundBasis],
        },
        recurrence: {
          value: recurrence,
          confidence: recurrence === 'unknown' ? 'low' : 'high',
          basis: [...recurrenceBasis, ...singleBasis],
        },
        freshness,
      },
      evidence: {
        sourceReference: {
          sourceId: demand.sourceId,
          rawEventId: demand.rawEventId,
          sourceUrl: demand.sourceUrl,
          adapterName: demand.provenance.adapterName,
          adapterVersion: demand.provenance.adapterVersion,
          accessMethod: demand.provenance.accessMethod,
          capturedAt: demand.capturedAt,
          publishedAt: demand.publishedAt,
        },
        classificationReferences,
      },
      provenance: {
        ...demand.provenance,
        transformations: [
          ...demand.provenance.transformations,
          `${INTELLIGENCE_CLASSIFICATION_VERSION}: deterministic rule classification`,
        ],
      },
    })

    if (!result.success) {
      this.log('intelligence.validation_failed', {
        status: 'failed',
        errorCode: 'VALIDATION_FAILED',
        data: { demandId: demand.id, issueCount: result.error.issues.length },
      })
      return failure('VALIDATION_FAILED', 'Intelligence result did not satisfy its contract.')
    }

    this.log(signal.value === 'unknown' ? 'intelligence.classification_unknown' : 'intelligence.classification_completed', {
      status: signal.value === 'unknown' ? 'unknown' : 'classified',
      data: { demandId: demand.id, signalCategory: signal.value, confidence: signalConfidence },
    })
    this.log('intelligence.freshness_evaluated', {
      status: freshness.value,
      data: { demandId: demand.id, timestampUsed: freshness.timestampUsed, ageDays: freshness.ageDays },
    })

    void context
    return success(result.data)
  }
}
