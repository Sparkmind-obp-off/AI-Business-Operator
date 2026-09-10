import { z } from 'zod'

export const VOICE_VERSION = 'voice-interface-v1' as const
export const VOICE_HISTORY_LIMIT = 4 as const

export const VoiceSessionStatusSchema = z.enum([
  'created',
  'active',
  'interrupted',
  'cancelled',
  'completed',
  'failed',
])

export const VoiceTurnStatusSchema = z.enum([
  'received',
  'processing',
  'approval_required',
  'completed',
  'interrupted',
  'cancelled',
  'failed',
])

export const VoiceIntentTypeSchema = z.enum([
  'inspect_opportunity',
  'summarize_opportunity',
  'recommend_action',
  'request_action',
  'approve_action',
  'cancel',
  'clarify',
  'unknown',
])

export const VoiceResponseStatusSchema = z.enum([
  'completed',
  'simulated',
  'approval_required',
  'clarification_required',
  'denied',
  'unavailable',
  'interrupted',
  'cancelled',
  'failed',
])

export const VoiceInputSchema = z.object({
  provider: z.string().min(1).max(80),
  synthetic: z.boolean(),
  utterance: z.string().trim().min(1).max(2_000),
  receivedAt: z.iso.datetime({ offset: true }),
}).strict()

export const VoiceIntentSchema = z.object({
  type: VoiceIntentTypeSchema,
  confidence: z.number().min(0).max(1),
  opportunityId: z.string().min(1).max(160).nullable(),
  pendingApprovalReference: z.string().min(1).max(512).nullable(),
  reason: z.string().min(1).max(300),
})

export const VoiceContextTurnSchema = z.object({
  turnId: z.string().min(1).max(160),
  intentType: VoiceIntentTypeSchema,
  responseStatus: VoiceResponseStatusSchema,
  occurredAt: z.iso.datetime({ offset: true }),
})

export const VoiceOperatorContextSchema = z.object({
  sessionId: z.string().min(1).max(160),
  turnId: z.string().min(1).max(160),
  normalizedGoal: z.string().min(1).max(2_000),
  opportunityId: z.string().min(1).max(160).nullable(),
  operatorRunId: z.string().min(1).max(160).nullable(),
  permissions: z.array(z.string().min(1).max(120)).max(20),
  pendingApprovalReference: z.string().min(1).max(512).nullable(),
  priorTurns: z.array(VoiceContextTurnSchema).max(VOICE_HISTORY_LIMIT),
  requestId: z.string().min(1).max(160),
  traceId: z.string().min(1).max(160),
})

export const VoiceProgressEventTypeSchema = z.enum([
  'voice.session.started',
  'voice.input.received',
  'voice.intent.detected',
  'voice.context.built',
  'voice.operator.started',
  'voice.tool.started',
  'voice.approval.required',
  'voice.action.started',
  'voice.result.received',
  'voice.response.ready',
  'voice.session.completed',
  'voice.session.failed',
  'voice.session.interrupted',
  'voice.session.cancelled',
])

export const VoiceProgressEventSchema = z.object({
  sequence: z.number().int().positive(),
  type: VoiceProgressEventTypeSchema,
  sessionId: z.string().min(1).max(160),
  turnId: z.string().min(1).max(160).nullable(),
  requestId: z.string().min(1).max(160),
  traceId: z.string().min(1).max(160),
  operatorRunId: z.string().min(1).max(160).nullable(),
  occurredAt: z.iso.datetime({ offset: true }),
  status: z.string().min(1).max(80),
  failureCode: z.string().min(1).max(120).nullable(),
  metadata: z.record(z.string(), z.unknown()),
})

export const VoiceResponseSchema = z.object({
  status: VoiceResponseStatusSchema,
  text: z.string().min(1).max(2_000),
  machineStatus: z.string().min(1).max(120),
  operatorRunId: z.string().min(1).max(160).nullable(),
  actionId: z.string().min(1).max(160).nullable(),
  approval: z.object({
    required: z.boolean(),
    reference: z.string().min(1).max(512).nullable(),
  }),
  synthetic: z.boolean(),
  sideEffectPerformed: z.boolean(),
  failureCode: z.string().min(1).max(120).nullable(),
})

export const VoiceTurnSchema = z.object({
  id: z.string().min(1).max(160),
  sessionId: z.string().min(1).max(160),
  requestId: z.string().min(1).max(160),
  traceId: z.string().min(1).max(160),
  status: VoiceTurnStatusSchema,
  input: VoiceInputSchema,
  intent: VoiceIntentSchema.nullable(),
  context: VoiceOperatorContextSchema.nullable(),
  response: VoiceResponseSchema.nullable(),
  operatorRunId: z.string().min(1).max(160).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
})

export const VoicePendingApprovalSchema = z.object({
  reference: z.string().min(1).max(512),
  actionId: z.string().min(1).max(160),
  opportunityId: z.string().min(1).max(160),
  actionType: z.string().min(1).max(120),
  description: z.string().min(1).max(2_000),
  operatorRunId: z.string().min(1).max(160),
  createdAt: z.iso.datetime({ offset: true }),
})

export const VoiceSessionSchema = z.object({
  version: z.literal(VOICE_VERSION),
  id: z.string().min(1).max(160),
  status: VoiceSessionStatusSchema,
  provider: z.string().min(1).max(80),
  synthetic: z.boolean(),
  turns: z.array(VoiceTurnSchema).max(20),
  pendingApproval: VoicePendingApprovalSchema.nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
  failureCode: z.string().min(1).max(120).nullable(),
  persistence: z.literal('process_local_memory'),
})

export const VoiceTurnRequestSchema = z.object({
  sessionId: VoiceSessionSchema.shape.id,
  input: VoiceInputSchema,
  opportunityId: z.string().min(1).max(160).optional(),
}).strict()

export const VoiceTurnResultSchema = z.object({
  session: VoiceSessionSchema,
  turn: VoiceTurnSchema,
  response: VoiceResponseSchema,
  events: z.array(VoiceProgressEventSchema).min(2),
})

export type VoiceSessionStatus = z.infer<typeof VoiceSessionStatusSchema>
export type VoiceTurnStatus = z.infer<typeof VoiceTurnStatusSchema>
export type VoiceIntent = z.infer<typeof VoiceIntentSchema>
export type VoiceInput = z.infer<typeof VoiceInputSchema>
export type VoiceResponse = z.infer<typeof VoiceResponseSchema>
export type VoiceTurn = z.infer<typeof VoiceTurnSchema>
export type VoiceSession = z.infer<typeof VoiceSessionSchema>
export type VoicePendingApproval = z.infer<typeof VoicePendingApprovalSchema>
export type VoiceProgressEvent = z.infer<typeof VoiceProgressEventSchema>
export type VoiceTurnResult = z.infer<typeof VoiceTurnResultSchema>
