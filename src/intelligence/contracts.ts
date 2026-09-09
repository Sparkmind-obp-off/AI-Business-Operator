import { z } from 'zod'
import { DemandProvenanceSchema, IntentTypeSchema } from '../domain'

export const INTELLIGENCE_CLASSIFICATION_VERSION = 'demand-intelligence-rules-v1' as const

export const ConfidenceLevelSchema = z.enum(['low', 'moderate', 'high'])
export const EvidenceStrengthLevelSchema = z.enum(['weak', 'moderate', 'strong'])
export const CommercialIntentLevelSchema = z.enum(['none', 'possible', 'strong', 'unknown'])
export const UrgencyLevelSchema = z.enum(['immediate', 'time_bound', 'unknown'])
export const FreshnessStatusSchema = z.enum(['fresh', 'aging', 'stale', 'invalid_future'])

const inferenceSchema = <T extends z.ZodType>(value: T) =>
  z.object({
    value,
    confidence: ConfidenceLevelSchema,
    basis: z.array(z.string().min(1)).default([]),
  })

export const DemandIntelligenceResultSchema = z.object({
  classificationVersion: z.literal(INTELLIGENCE_CLASSIFICATION_VERSION),
  demandId: z.string().min(3),
  detected: z.object({
    sourceId: z.string().min(3),
    rawEventId: z.string().min(3),
    sourceUrl: z.url(),
    text: z.string().min(1),
    capturedAt: z.iso.datetime({ offset: true }),
    publishedAt: z.iso.datetime({ offset: true }).nullable(),
  }),
  inferred: z.object({
    signalCategory: inferenceSchema(IntentTypeSchema),
    intent: inferenceSchema(z.enum(['informational_request', 'service_project', 'purchase', 'comparison_recommendation', 'unknown'])),
    evidenceStrength: inferenceSchema(EvidenceStrengthLevelSchema),
    commercialIntent: inferenceSchema(CommercialIntentLevelSchema),
    urgency: inferenceSchema(UrgencyLevelSchema),
    recurrence: inferenceSchema(z.enum(['single', 'repeated', 'unknown'])),
    freshness: inferenceSchema(FreshnessStatusSchema).extend({
      evaluatedAt: z.iso.datetime({ offset: true }),
      timestampUsed: z.enum(['publishedAt', 'capturedAt']),
      ageDays: z.number().nonnegative().nullable(),
    }),
  }),
  evidence: z.object({
    sourceReference: z.object({
      sourceId: z.string().min(3),
      rawEventId: z.string().min(3),
      sourceUrl: z.url(),
      adapterName: z.string().min(1),
      adapterVersion: z.string().min(1),
      accessMethod: z.string().min(1),
      capturedAt: z.iso.datetime({ offset: true }),
      publishedAt: z.iso.datetime({ offset: true }).nullable(),
    }),
    classificationReferences: z.array(
      z.object({
        attribute: z.string().min(1),
        matchedText: z.string().min(1),
      }),
    ),
  }),
  provenance: DemandProvenanceSchema,
})

export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>
export type DemandIntelligenceResult = z.infer<typeof DemandIntelligenceResultSchema>
