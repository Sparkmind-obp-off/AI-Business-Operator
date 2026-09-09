import { z } from 'zod'
import {
  AuditEventSchema,
  DemandProvenanceSchema,
  OperatorRunSchema,
  OpportunitySchema,
  ScoreSchema,
  ToolCallSchema,
} from '../domain'
import { OpportunitySourceReferenceSchema } from '../opportunities'
import { ScoreBandSchema, ScoreComponentSchema } from '../scoring'

export const OPERATOR_VERSION = 'operator-orchestration-v1' as const

export const OperatorGoalSchema = z.object({
  goal: z.string().trim().min(1).max(4_000),
  opportunityId: OpportunitySchema.shape.id,
  requestedTool: z.string().trim().min(1).max(120).optional(),
})

export const OperatorContextSchema = z.object({
  opportunity: OpportunitySchema.pick({
    id: true,
    status: true,
    title: true,
    offerHypothesis: true,
    segment: true,
    confidence: true,
    demandIds: true,
  }),
  score: z.object({
    id: ScoreSchema.shape.id,
    version: ScoreSchema.shape.scoreVersion,
    total: ScoreSchema.shape.totalScore,
    band: ScoreBandSchema,
    state: z.enum(['current', 'stale']),
    breakdown: z.array(ScoreComponentSchema).length(7),
  }),
  evidence: z.object({
    references: z.array(z.string().min(1).max(256)).min(1),
    sources: z.array(OpportunitySourceReferenceSchema).min(1),
    provenance: DemandProvenanceSchema,
  }),
  unknowns: z.array(z.string().min(1).max(120)),
})

export const OperatorPlanSchema = z.object({
  version: z.literal(OPERATOR_VERSION),
  steps: z.array(z.string().min(1).max(500)).min(3).max(8),
  recommendation: z.string().min(1).max(1_000),
  facts: z.array(z.string().min(1).max(500)).min(1),
  derived: z.array(z.string().min(1).max(500)).min(1),
  unknowns: z.array(z.string().min(1).max(120)),
})

export const ToolRiskSchema = z.enum(['low', 'medium', 'high'])
export const ApprovalPolicySchema = z.enum(['none', 'conditional', 'always', 'disabled'])

export const ToolDefinitionSchema = z.object({
  name: z.string().min(1).max(120),
  version: z.string().min(1).max(40),
  description: z.string().min(1).max(500),
  requiredPermissions: z.array(z.string().min(1).max(120)),
  riskLevel: ToolRiskSchema,
  approvalPolicy: ApprovalPolicySchema,
  timeoutMs: z.number().int().positive().max(30_000),
  maxRetries: z.number().int().min(0).max(3),
  auditRequired: z.boolean(),
  providerDependencies: z.array(z.string().min(1).max(120)),
  enabled: z.boolean(),
})

export const InspectOpportunityInputSchema = z.object({
  opportunityId: OpportunitySchema.shape.id,
})

export const InspectOpportunityOutputSchema = z.object({
  opportunityId: OpportunitySchema.shape.id,
  scoreId: ScoreSchema.shape.id,
  evidenceReferences: z.array(z.string().min(1).max(256)).min(1),
  status: z.literal('inspected'),
})

export const ApprovalFixtureInputSchema = z.object({
  opportunityId: OpportunitySchema.shape.id,
  proposedAction: z.string().min(1).max(500),
})

export const ApprovalFixtureOutputSchema = z.object({
  status: z.literal('not_executed'),
})

export const OperatorRunRecordSchema = z.object({
  run: OperatorRunSchema,
  context: OperatorContextSchema.nullable(),
  plan: OperatorPlanSchema.nullable(),
  toolCalls: z.array(ToolCallSchema),
  auditEvents: z.array(AuditEventSchema).min(1),
})

export const OperatorResultSchema = z.object({
  runId: OperatorRunSchema.shape.id,
  status: z.enum(['completed', 'approval_required', 'denied', 'unavailable', 'failed']),
  plan: OperatorPlanSchema,
  recommendation: z.string().min(1).max(1_000),
  approval: z.object({
    required: z.boolean(),
    reason: z.string().min(1).max(500).nullable(),
  }),
  tool: z.object({
    name: z.string().min(1).max(120),
    version: z.string().min(1).max(40),
    permissionDecision: z.enum(['allowed', 'denied', 'approval_required']),
    invocationStatus: z.enum(['not_invoked', 'completed', 'failed']),
    resultValidationStatus: z.enum(['not_applicable', 'valid', 'invalid']),
    output: z.unknown().nullable(),
  }),
  evidence: z.array(z.string().min(1).max(256)).min(1),
  persistence: z.literal('process_local_memory'),
})

export type OperatorGoal = z.infer<typeof OperatorGoalSchema>
export type OperatorContext = z.infer<typeof OperatorContextSchema>
export type OperatorPlan = z.infer<typeof OperatorPlanSchema>
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>
export type OperatorRunRecord = z.infer<typeof OperatorRunRecordSchema>
export type OperatorResult = z.infer<typeof OperatorResultSchema>
