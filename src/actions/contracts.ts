import { z } from 'zod'
import { ActionOutcomeSchema, ActionSchema, AuditEventSchema } from '../domain'
import { ApprovalPolicySchema, ToolRiskSchema } from '../operator'

export const ACTION_EXECUTION_VERSION = 'action-execution-v1' as const

export const ActionApprovalSchema = z.object({
  reference: z.string().min(1).max(512),
  actionId: ActionSchema.shape.id,
  approvedBy: z.string().min(1).max(128),
  approvedAt: z.iso.datetime({ offset: true }),
})

export const ActionExecutionRequestSchema = z.object({
  action: ActionSchema,
  idempotencyKey: z.string().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/),
  approval: ActionApprovalSchema.nullable().default(null),
})

export const FixtureActionInputSchema = z.object({
  actionId: ActionSchema.shape.id,
  opportunityId: ActionSchema.shape.opportunityId,
  description: ActionSchema.shape.description,
  idempotencyKey: ActionExecutionRequestSchema.shape.idempotencyKey,
}).strict()

export const FixtureActionResultSchema = z.object({
  status: z.literal('simulated'),
  executionReference: z.string().regex(/^fixture:\/\/[a-z0-9/_-]+$/),
  actionId: ActionSchema.shape.id,
  idempotencyKey: ActionExecutionRequestSchema.shape.idempotencyKey,
  sideEffectPerformed: z.literal(false),
  synthetic: z.literal(true),
  message: z.literal('Deterministic fixture execution only; no external side effect occurred.'),
}).strict()

export const ActionExecutorDefinitionSchema = z.object({
  name: z.string().min(1).max(120),
  version: z.string().min(1).max(40),
  actionType: z.string().min(1).max(120),
  requiredPermissions: z.array(z.string().min(1).max(120)).min(1),
  riskLevel: ToolRiskSchema,
  approvalPolicy: ApprovalPolicySchema,
  timeoutMs: z.number().int().positive().max(30_000),
  maxRetries: z.number().int().min(0).max(3),
  enabled: z.boolean(),
})

export const ActionExecutionRecordSchema = z.object({
  version: z.literal(ACTION_EXECUTION_VERSION),
  action: ActionSchema,
  outcome: ActionOutcomeSchema,
  idempotencyKey: ActionExecutionRequestSchema.shape.idempotencyKey,
  inputHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  executorName: z.string().min(1).max(120),
  executorVersion: z.string().min(1).max(40),
  approvalReference: z.string().min(1).max(512).nullable(),
  retryable: z.boolean(),
  errorCode: z.string().min(1).max(120).nullable(),
  auditEvents: z.array(AuditEventSchema).min(1),
  persistence: z.literal('process_local_memory'),
})

export const ActionExecutionResponseSchema = z.object({
  status: z.enum([
    'simulated',
    'approval_required',
    'denied',
    'unavailable',
    'duplicate',
    'idempotency_conflict',
    'failed',
    'timed_out',
    'cancelled',
  ]),
  action: ActionSchema.nullable(),
  outcome: ActionOutcomeSchema.nullable(),
  executor: z.object({
    name: z.string().min(1).max(120),
    version: z.string().min(1).max(40),
  }).nullable(),
  approval: z.object({
    required: z.boolean(),
    reference: z.string().min(1).max(512).nullable(),
  }),
  duplicate: z.boolean(),
  retryable: z.boolean(),
  errorCode: z.string().min(1).max(120).nullable(),
  persistence: z.literal('process_local_memory'),
})

export type ActionApproval = z.infer<typeof ActionApprovalSchema>
export type ActionExecutionRequest = z.infer<typeof ActionExecutionRequestSchema>
export type FixtureActionInput = z.infer<typeof FixtureActionInputSchema>
export type FixtureActionResult = z.infer<typeof FixtureActionResultSchema>
export type ActionExecutorDefinition = z.infer<typeof ActionExecutorDefinitionSchema>
export type ActionExecutionRecord = z.infer<typeof ActionExecutionRecordSchema>
export type ActionExecutionResponse = z.infer<typeof ActionExecutionResponseSchema>
