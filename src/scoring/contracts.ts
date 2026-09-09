import { z } from 'zod'
import { DemandObjectSchema, OpportunitySchema, ScoreSchema } from '../domain'
import { DemandIntelligenceResultSchema } from '../intelligence'
import { OpportunityRecordSchema } from '../opportunities'

export const OPPORTUNITY_SCORING_VERSION = 'opportunity-scoring-v1' as const

export const ScoreBandSchema = z.enum(['priority', 'strong', 'watchlist', 'low'])
export const ScoreEvidenceStatusSchema = z.enum(['observed', 'derived', 'unknown'])
export const ScoreDimensionNameSchema = z.enum([
  'demandStrength',
  'commercialIntent',
  'frequency',
  'urgency',
  'reachability',
  'marketGap',
  'executionFeasibility',
])

export const ScoreComponentSchema = z.object({
  dimension: ScoreDimensionNameSchema,
  normalizedValue: z.number().min(0).max(1),
  weight: z.number().positive().max(100),
  weightedContribution: z.number().min(0).max(100),
  evidenceStatus: ScoreEvidenceStatusSchema,
  confidenceModifier: z.number().min(0).max(1),
  freshnessModifier: z.number().min(0).max(1),
  evidenceReferences: z.array(z.string().min(1).max(256)),
  explanation: z.string().min(1).max(500),
})

export const ScoreRecordSchema = z.object({
  score: ScoreSchema,
  band: ScoreBandSchema,
  breakdown: z.array(ScoreComponentSchema).length(7),
  evidenceReferences: z.array(z.string().min(1).max(256)).min(1),
  inputFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  calculationMetadata: z.object({
    formula: z.literal('sum(normalized_value * confidence_modifier * freshness_modifier * weight)'),
    weightTotal: z.literal(100),
    deterministic: z.literal(true),
    guaranteeDisclaimer: z.literal('Prioritization signal only; not a guarantee of purchase, conversion, or revenue.'),
  }),
}).superRefine((value, context) => {
  if (value.breakdown.some((component) => component.weightedContribution > component.weight)) {
    context.addIssue({ code: 'custom', path: ['breakdown'], message: 'component contribution cannot exceed its weight' })
  }
  const contributionTotal = value.breakdown.reduce((sum, component) => sum + component.weightedContribution, 0)
  if (Math.abs(contributionTotal - value.score.totalScore) > 0.01) {
    context.addIssue({ code: 'custom', path: ['score', 'totalScore'], message: 'must equal breakdown contribution total' })
  }
})

export const ScoreOpportunityInputSchema = z.object({
  opportunityRecord: OpportunityRecordSchema,
  demand: DemandObjectSchema,
  intelligence: DemandIntelligenceResultSchema,
}).superRefine((value, context) => {
  const opportunity = value.opportunityRecord.opportunity
  if (!opportunity.demandIds.includes(value.demand.id)) {
    context.addIssue({ code: 'custom', path: ['demand', 'id'], message: 'must be linked to the opportunity' })
  }
  if (value.demand.id !== value.intelligence.demandId) {
    context.addIssue({ code: 'custom', path: ['intelligence', 'demandId'], message: 'must match demand.id' })
  }
  if (value.demand.sourceId !== value.intelligence.detected.sourceId
    || value.demand.rawEventId !== value.intelligence.detected.rawEventId
    || value.demand.sourceUrl !== value.intelligence.detected.sourceUrl) {
    context.addIssue({ code: 'custom', path: ['intelligence', 'detected'], message: 'must match demand provenance' })
  }
})

export const ScoreApiRequestSchema = z.object({
  demand: DemandObjectSchema,
  intelligence: DemandIntelligenceResultSchema,
})

export const ScoredOpportunitySchema = OpportunitySchema.extend({
  status: z.literal('scored'),
  currentScore: z.number().min(0).max(100),
  scoreVersion: z.literal(OPPORTUNITY_SCORING_VERSION),
})

export type ScoreBand = z.infer<typeof ScoreBandSchema>
export type ScoreComponent = z.infer<typeof ScoreComponentSchema>
export type ScoreRecord = z.infer<typeof ScoreRecordSchema>
export type ScoreOpportunityInput = z.infer<typeof ScoreOpportunityInputSchema>
