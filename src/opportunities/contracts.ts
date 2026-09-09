import { z } from 'zod'
import {
  DemandObjectSchema,
  OpportunityEvidenceSchema,
  OpportunitySchema,
} from '../domain'
import { DemandIntelligenceResultSchema } from '../intelligence'

export const OPPORTUNITY_CREATION_VERSION = 'opportunity-creation-v1' as const

export const OpportunityStatusSchema = OpportunitySchema.shape.status

export const OpportunityLifecycleEventSchema = z.object({
  opportunityId: OpportunitySchema.shape.id,
  fromStatus: OpportunityStatusSchema.nullable(),
  toStatus: OpportunityStatusSchema,
  reason: z.string().min(1).max(500),
  occurredAt: OpportunitySchema.shape.createdAt,
})

export const OpportunitySourceReferenceSchema = z.object({
  sourceId: DemandObjectSchema.shape.sourceId,
  rawEventId: DemandObjectSchema.shape.rawEventId,
  sourceUrl: DemandObjectSchema.shape.sourceUrl,
  adapterName: z.string().min(1).max(120),
  adapterVersion: z.string().min(1).max(40),
  accessMethod: z.string().min(1).max(80),
  capturedAt: DemandObjectSchema.shape.capturedAt,
  publishedAt: DemandObjectSchema.shape.publishedAt,
})

export const OpportunityRecordSchema = z.object({
  opportunity: OpportunitySchema,
  evidenceLinks: z.array(OpportunityEvidenceSchema).min(1),
  sourceReferences: z.array(OpportunitySourceReferenceSchema).min(1),
  provenance: DemandObjectSchema.shape.provenance,
  lifecycleHistory: z.array(OpportunityLifecycleEventSchema).min(1),
  identityKey: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  creationVersion: z.literal(OPPORTUNITY_CREATION_VERSION),
}).superRefine((value, context) => {
  const demandIds = new Set(value.opportunity.demandIds)
  if (value.evidenceLinks.some((link) => link.opportunityId !== value.opportunity.id)) {
    context.addIssue({ code: 'custom', path: ['evidenceLinks'], message: 'opportunity IDs must match' })
  }
  if (value.evidenceLinks.some((link) => !demandIds.has(link.demandId))) {
    context.addIssue({ code: 'custom', path: ['evidenceLinks'], message: 'evidence demand IDs must be linked' })
  }
  if (value.provenance.sourceId !== value.sourceReferences[0]?.sourceId
    || value.provenance.rawEventId !== value.sourceReferences[0]?.rawEventId) {
    context.addIssue({ code: 'custom', path: ['provenance'], message: 'must match the primary source reference' })
  }
})

export const CreateOpportunityInputSchema = z.object({
  demand: DemandObjectSchema,
  intelligence: DemandIntelligenceResultSchema,
}).superRefine((value, context) => {
  if (value.demand.id !== value.intelligence.demandId) {
    context.addIssue({ code: 'custom', path: ['intelligence', 'demandId'], message: 'must match demand.id' })
  }
  if (value.demand.sourceId !== value.intelligence.detected.sourceId
    || value.demand.rawEventId !== value.intelligence.detected.rawEventId
    || value.demand.sourceUrl !== value.intelligence.detected.sourceUrl) {
    context.addIssue({ code: 'custom', path: ['intelligence', 'detected'], message: 'must match demand provenance' })
  }
})

export type OpportunityStatus = z.infer<typeof OpportunityStatusSchema>
export type OpportunityLifecycleEvent = z.infer<typeof OpportunityLifecycleEventSchema>
export type OpportunityRecord = z.infer<typeof OpportunityRecordSchema>
export type CreateOpportunityInput = z.infer<typeof CreateOpportunityInputSchema>
