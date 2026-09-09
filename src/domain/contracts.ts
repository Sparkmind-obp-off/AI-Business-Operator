import { z } from 'zod'

export const CONTRACT_VERSION = '1.0' as const

const idSchema = z.string().min(3).max(128).regex(/^[a-z][a-z0-9_-]+$/)
const timestampSchema = z.iso.datetime({ offset: true })
const normalizedScoreSchema = z.number().min(0).max(1)
const percentageScoreSchema = z.number().min(0).max(100)
const metadataSchema = z.record(z.string(), z.unknown())

export const SourceTypeSchema = z.enum([
  'social',
  'forum',
  'job_board',
  'search',
  'marketplace',
  'integration',
  'manual',
])

export const CapabilityStatusSchema = z.enum([
  'available',
  'approval_required',
  'integration_available',
  'limited',
  'unavailable',
  'degraded',
  'unknown',
])

export const ProvenanceSchema = z.object({
  sourceId: idSchema,
  sourceUrl: z.url(),
  adapterName: z.string().min(1).max(120),
  adapterVersion: z.string().min(1).max(40),
  accessMethod: z.enum(['fixture', 'manual', 'official_api', 'authorized_integration', 'search_index']),
  capturedAt: timestampSchema,
  transformations: z.array(z.string().min(1)).default([]),
})

export const DemandProvenanceSchema = ProvenanceSchema.extend({
  rawEventId: idSchema,
})

export const SourceSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  id: idSchema,
  provider: z.string().min(1).max(120),
  sourceType: SourceTypeSchema,
  displayName: z.string().min(1).max(160),
  status: CapabilityStatusSchema,
  capabilities: z.array(z.string().min(1)).min(1),
  authMode: z.enum(['none', 'api_key', 'oauth2', 'webhook_secret']),
  capabilityMetadata: metadataSchema,
  termsReference: z.url(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export const RawEventSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  id: idSchema,
  sourceId: idSchema,
  externalEventId: z.string().min(1).max(256),
  payloadReference: z.string().min(1).max(512),
  payloadHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  sourceUrl: z.url(),
  capturedAt: timestampSchema,
  publishedAt: timestampSchema.nullable(),
  ingestionVersion: z.string().min(1).max(40),
  receivedAt: timestampSchema,
  processingStatus: z.enum(['received', 'validated', 'normalized', 'rejected']),
  errorCode: z.string().min(1).nullable(),
  content: z.object({
    text: z.string().min(1).max(20_000),
    language: z.string().min(2).max(20),
    metadata: metadataSchema,
  }),
  provenance: ProvenanceSchema,
})

export const IntentTypeSchema = z.enum([
  'explicit_request',
  'job_requirement',
  'repeated_pain_point',
  'purchase_intent',
  'comparison_request',
  'unmet_service_need',
  'recurring_workflow_problem',
  'product_gap',
  'commercial_trend',
  'unknown',
])

export const DemandObjectSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  id: idSchema,
  sourceId: idSchema,
  rawEventId: idSchema,
  sourceUrl: z.url(),
  capturedAt: timestampSchema,
  publishedAt: timestampSchema.nullable(),
  authorReference: z.string().min(1).max(256).nullable(),
  text: z.string().min(1).max(20_000),
  summary: z.string().min(1).max(2_000),
  topic: z.string().min(1).max(160),
  market: z.string().min(1).max(160),
  location: z.string().min(1).max(160).nullable(),
  intentType: IntentTypeSchema,
  evidenceStrength: normalizedScoreSchema,
  commercialIntent: normalizedScoreSchema,
  urgency: normalizedScoreSchema,
  recurrence: z.enum(['single', 'repeated', 'unknown']),
  estimatedBudgetSignal: z.string().min(1).max(256).nullable(),
  contactability: z.enum(['unknown', 'source_reply', 'public_business_channel', 'not_permitted']),
  confidence: normalizedScoreSchema,
  observedFacts: z.array(z.string().min(1)).min(1),
  inferences: z.array(
    z.object({
      statement: z.string().min(1),
      confidence: normalizedScoreSchema,
    }),
  ),
  classificationVersion: z.string().min(1).max(40),
  provenance: DemandProvenanceSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}).superRefine((value, context) => {
  if (value.sourceId !== value.provenance.sourceId) {
    context.addIssue({ code: 'custom', path: ['provenance', 'sourceId'], message: 'must match sourceId' })
  }
  if (value.rawEventId !== value.provenance.rawEventId) {
    context.addIssue({ code: 'custom', path: ['provenance', 'rawEventId'], message: 'must match rawEventId' })
  }
  if (value.sourceUrl !== value.provenance.sourceUrl) {
    context.addIssue({ code: 'custom', path: ['provenance', 'sourceUrl'], message: 'must match sourceUrl' })
  }
})

export const DemandEvidenceSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  id: idSchema,
  demandId: idSchema,
  evidenceType: z.enum(['source_excerpt', 'source_metadata', 'corroboration']),
  reference: z.string().min(1).max(512),
  excerptReference: z.string().min(1).max(512).nullable(),
  strength: normalizedScoreSchema,
  capturedAt: timestampSchema,
  metadata: metadataSchema,
})

export const OpportunitySchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  id: idSchema,
  demandIds: z.array(idSchema).min(1),
  title: z.string().min(1).max(240),
  problemStatement: z.string().min(1).max(2_000),
  offerHypothesis: z.string().min(1).max(2_000),
  market: z.string().min(1).max(160),
  segment: z.string().min(1).max(160),
  status: z.enum(['new', 'enriched', 'scored', 'qualified', 'action_ready', 'acted_on', 'measured', 'learned']),
  currentScore: percentageScoreSchema.nullable(),
  scoreVersion: z.string().min(1).max(40).nullable(),
  confidence: normalizedScoreSchema,
  evidenceSummary: z.string().min(1).max(2_000),
  recommendedNextAction: z.string().min(1).max(1_000),
  owner: z.string().min(1).max(128).nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export const OpportunityEvidenceSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  opportunityId: idSchema,
  demandId: idSchema,
  relationshipType: z.enum(['primary', 'supporting', 'contradicting']),
  weight: normalizedScoreSchema,
  createdAt: timestampSchema,
})

export const ScoreSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  id: idSchema,
  opportunityId: idSchema,
  scoreVersion: z.string().min(1).max(40),
  totalScore: percentageScoreSchema,
  dimensions: z.object({
    demandStrength: percentageScoreSchema,
    commercialIntent: percentageScoreSchema,
    frequency: percentageScoreSchema,
    urgency: percentageScoreSchema,
    reachability: percentageScoreSchema,
    marketGap: percentageScoreSchema,
    executionFeasibility: percentageScoreSchema,
  }),
  evidenceAdjustment: z.number().min(-100).max(100),
  confidence: normalizedScoreSchema,
  reasoningSummary: z.string().min(1).max(2_000),
  createdAt: timestampSchema,
})

export const ActionSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  id: idSchema,
  opportunityId: idSchema,
  actionType: z.string().min(1).max(120),
  description: z.string().min(1).max(2_000),
  status: z.enum(['draft', 'awaiting_approval', 'approved', 'executing', 'completed', 'rejected', 'failed', 'cancelled']),
  riskLevel: z.enum(['low', 'medium', 'high']),
  requiresApproval: z.boolean(),
  approvedAt: timestampSchema.nullable(),
  approvedBy: z.string().min(1).max(128).nullable(),
  inputReference: z.string().min(1).max(512).nullable(),
  executionReference: z.string().min(1).max(512).nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}).superRefine((value, context) => {
  if (value.riskLevel === 'high' && !value.requiresApproval) {
    context.addIssue({ code: 'custom', path: ['requiresApproval'], message: 'high-risk actions require approval' })
  }
  const approved = value.approvedAt !== null || value.approvedBy !== null
  if ((value.approvedAt === null) !== (value.approvedBy === null)) {
    context.addIssue({ code: 'custom', path: ['approvedAt'], message: 'approval timestamp and actor must be present together' })
  }
  if (value.status === 'approved' && !approved) {
    context.addIssue({ code: 'custom', path: ['status'], message: 'approved actions require explicit approval metadata' })
  }
  if (!value.requiresApproval && approved) {
    context.addIssue({ code: 'custom', path: ['approvedAt'], message: 'approval metadata is not valid when approval is not required' })
  }
  if (value.status === 'completed' && value.executionReference === null) {
    context.addIssue({ code: 'custom', path: ['executionReference'], message: 'completed actions require an execution reference' })
  }
})

export const ActionOutcomeSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  id: idSchema,
  actionId: idSchema,
  outcomeType: z.enum(['succeeded', 'failed', 'rejected', 'cancelled', 'unknown']),
  result: z.string().min(1).max(2_000),
  metrics: metadataSchema,
  externalReference: z.string().min(1).max(512).nullable(),
  observedAt: timestampSchema,
})

export const OperatorRunSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  id: idSchema,
  userGoal: z.string().min(1).max(4_000),
  contextReference: z.string().min(1).max(512).nullable(),
  planReference: z.string().min(1).max(512).nullable(),
  status: z.enum(['planned', 'running', 'awaiting_approval', 'completed', 'failed', 'cancelled']),
  modelProvider: z.string().min(1).max(120).nullable(),
  modelVersion: z.string().min(1).max(120).nullable(),
  startedAt: timestampSchema,
  completedAt: timestampSchema.nullable(),
  failureCode: z.string().min(1).max(120).nullable(),
})

export const ToolCallSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  id: idSchema,
  operatorRunId: idSchema,
  toolName: z.string().min(1).max(120),
  toolVersion: z.string().min(1).max(40),
  inputHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  outputReference: z.string().min(1).max(512).nullable(),
  permissionDecision: z.enum(['allowed', 'denied', 'approval_required']),
  approvalReference: z.string().min(1).max(512).nullable(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'denied']),
  startedAt: timestampSchema,
  completedAt: timestampSchema.nullable(),
  errorCode: z.string().min(1).max(120).nullable(),
})

export const AuditEventSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  id: idSchema,
  occurredAt: timestampSchema,
  actorType: z.enum(['user', 'system', 'operator', 'tool']),
  actorReference: z.string().min(1).max(256),
  entityType: z.string().min(1).max(120),
  entityId: idSchema,
  eventName: z.string().min(1).max(160),
  requestId: z.string().min(1).max(128),
  traceId: z.string().min(1).max(128),
  runId: idSchema.nullable(),
  metadata: metadataSchema,
  resultStatus: z.enum(['success', 'failure', 'denied', 'unknown']),
})

export type CapabilityStatus = z.infer<typeof CapabilityStatusSchema>
export type Source = z.infer<typeof SourceSchema>
export type RawEvent = z.infer<typeof RawEventSchema>
export type DemandObject = z.infer<typeof DemandObjectSchema>
export type DemandEvidence = z.infer<typeof DemandEvidenceSchema>
export type Opportunity = z.infer<typeof OpportunitySchema>
export type OpportunityEvidence = z.infer<typeof OpportunityEvidenceSchema>
export type Score = z.infer<typeof ScoreSchema>
export type Action = z.infer<typeof ActionSchema>
export type ActionOutcome = z.infer<typeof ActionOutcomeSchema>
export type OperatorRun = z.infer<typeof OperatorRunSchema>
export type ToolCall = z.infer<typeof ToolCallSchema>
export type AuditEvent = z.infer<typeof AuditEventSchema>
