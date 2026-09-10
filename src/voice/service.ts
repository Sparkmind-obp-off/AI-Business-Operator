import { ActionSchema, CONTRACT_VERSION } from '../domain'
import { idFromHash, sha256 } from '../ingestion/deterministic'
import type { ActionExecutionService } from '../actions'
import type { OperatorService } from '../operator'
import {
  VOICE_HISTORY_LIMIT,
  VOICE_VERSION,
  VoiceContextTurnSchema,
  VoiceOperatorContextSchema,
  VoiceProgressEventSchema,
  VoiceResponseSchema,
  VoiceSessionSchema,
  VoiceTurnRequestSchema,
  VoiceTurnResultSchema,
  VoiceTurnSchema,
  type VoiceProgressEvent,
  type VoiceResponse,
  type VoiceSession,
  type VoiceTurnResult,
} from './contracts'
import { extractDeterministicIntent } from './intent'
import type { VoiceInputProvider, VoiceResponseProvider } from './providers'
import type { VoiceSessionRepository } from './repository'

export interface VoiceExecutionContext {
  requestId: string
  traceId: string
  permissions: ReadonlySet<string>
  actorReference: string
}

export type VoiceLog = (
  eventName: string,
  fields: { status: string; errorCode?: string; data?: Record<string, unknown> },
) => void

export interface VoiceServiceOptions {
  repository: VoiceSessionRepository
  inputProvider: VoiceInputProvider
  responseProvider: VoiceResponseProvider
  operatorService: OperatorService
  actionService: ActionExecutionService
  now?: () => string
  log?: VoiceLog
}

function response(value: Omit<VoiceResponse, 'synthetic'>, provider: VoiceResponseProvider): VoiceResponse {
  return provider.render(VoiceResponseSchema.parse({ ...value, synthetic: true }))
}

function mapOperatorResponse(
  result: Awaited<ReturnType<OperatorService['run']>>,
  provider: VoiceResponseProvider,
): VoiceResponse {
  if (!result.ok) {
    return response({
      status: 'failed',
      text: `Operator gagal secara aman: ${result.error.message}`,
      machineStatus: result.error.code,
      operatorRunId: null,
      actionId: null,
      approval: { required: false, reference: null },
      sideEffectPerformed: false,
      failureCode: result.error.code,
    }, provider)
  }
  const value = result.value
  const status = value.status === 'approval_required'
    ? 'approval_required'
    : value.status === 'completed'
      ? 'completed'
      : value.status === 'denied'
        ? 'denied'
        : value.status === 'unavailable'
          ? 'unavailable'
          : 'failed'
  return response({
    status,
    text: value.status === 'completed'
      ? value.recommendation
      : value.status === 'approval_required'
        ? `Menunggu approval. ${value.recommendation}`
        : `Permintaan tidak dijalankan. Status Operator: ${value.status}.`,
    machineStatus: value.status,
    operatorRunId: value.runId,
    actionId: null,
    approval: { required: value.approval.required, reference: value.approval.reference },
    sideEffectPerformed: false,
    failureCode: value.status === 'failed' ? 'OPERATOR_FAILED' : null,
  }, provider)
}

function mapActionResponse(
  result: Awaited<ReturnType<ActionExecutionService['execute']>>,
  provider: VoiceResponseProvider,
): VoiceResponse {
  const status = result.status === 'simulated' || result.status === 'duplicate'
    ? 'simulated'
    : result.status === 'approval_required'
      ? 'approval_required'
      : result.status === 'denied' || result.status === 'idempotency_conflict'
        ? 'denied'
        : result.status === 'unavailable'
          ? 'unavailable'
          : result.status === 'cancelled'
            ? 'cancelled'
            : 'failed'
  const text = result.status === 'simulated'
    ? 'Aksi fixture tervalidasi sebagai simulasi. Tidak ada efek eksternal yang dilakukan.'
    : result.status === 'duplicate'
      ? 'Aksi fixture telah diproses sebelumnya. Tidak ada eksekusi kedua.'
      : result.status === 'approval_required'
        ? 'Aksi masih menunggu approval yang cocok.'
        : `Eksekusi aksi berhenti pada status aktual: ${result.status}.`
  return response({
    status,
    text,
    machineStatus: result.status,
    operatorRunId: null,
    actionId: result.action?.id ?? null,
    approval: result.approval,
    sideEffectPerformed: false,
    failureCode: result.errorCode,
  }, provider)
}

export class VoiceService {
  private readonly repository: VoiceSessionRepository
  private readonly inputProvider: VoiceInputProvider
  private readonly responseProvider: VoiceResponseProvider
  private readonly operatorService: OperatorService
  private readonly actionService: ActionExecutionService
  private readonly now: () => string
  private readonly log: VoiceLog

  constructor(options: VoiceServiceOptions) {
    this.repository = options.repository
    this.inputProvider = options.inputProvider
    this.responseProvider = options.responseProvider
    this.operatorService = options.operatorService
    this.actionService = options.actionService
    this.now = options.now ?? (() => new Date().toISOString())
    this.log = options.log ?? (() => undefined)
  }

  async createSession(context: Pick<VoiceExecutionContext, 'requestId' | 'traceId'>): Promise<VoiceSession> {
    const createdAt = this.now()
    const hash = await sha256({ version: VOICE_VERSION, createdAt, requestId: context.requestId, traceId: context.traceId })
    const session = VoiceSessionSchema.parse({
      version: VOICE_VERSION,
      id: idFromHash('voice_session', hash),
      status: 'created',
      provider: this.inputProvider.name,
      synthetic: true,
      turns: [],
      pendingApproval: null,
      createdAt,
      updatedAt: createdAt,
      completedAt: null,
      failureCode: null,
      persistence: 'process_local_memory',
    })
    this.repository.save(session)
    this.log('voice.session.started', { status: 'created', data: { sessionId: session.id, synthetic: true } })
    return session
  }

  async processTurn(
    inputValue: { sessionId: string; utterance: unknown; opportunityId?: string },
    execution: VoiceExecutionContext,
  ): Promise<VoiceTurnResult> {
    let session = this.repository.findById(inputValue.sessionId)
    if (!session) throw new Error('VOICE_SESSION_NOT_FOUND')
    if (['cancelled', 'completed', 'failed'].includes(session.status)) throw new Error('VOICE_SESSION_TERMINAL')
    if (session.status === 'created' || session.status === 'interrupted') {
      session = this.repository.transition(session.id, 'active', this.now())
    }

    const input = this.inputProvider.normalize(inputValue.utterance)
    VoiceTurnRequestSchema.parse({ sessionId: session.id, input, opportunityId: inputValue.opportunityId })
    const turnHash = await sha256({ sessionId: session.id, turnNumber: session.turns.length + 1, receivedAt: input.receivedAt })
    const turnId = idFromHash('voice_turn', turnHash)
    const events: VoiceProgressEvent[] = []
    const currentSessionId = session.id
    let operatorRunId: string | null = null
    const emit = (type: VoiceProgressEvent['type'], status: string, metadata: Record<string, unknown> = {}, failureCode: string | null = null) => {
      events.push(VoiceProgressEventSchema.parse({
        sequence: events.length + 1,
        type,
        sessionId: currentSessionId,
        turnId,
        requestId: execution.requestId,
        traceId: execution.traceId,
        operatorRunId,
        occurredAt: this.now(),
        status,
        failureCode,
        metadata,
      }))
    }

    if (session.turns.length === 0) emit('voice.session.started', 'active', { provider: session.provider, synthetic: true })
    emit('voice.input.received', 'received', { provider: input.provider, synthetic: input.synthetic })
    const intent = extractDeterministicIntent(input.utterance, {
      opportunityId: inputValue.opportunityId ?? session.pendingApproval?.opportunityId,
      pendingApprovalReference: session.pendingApproval?.reference,
    })
    emit('voice.intent.detected', 'detected', { intentType: intent.type, confidence: intent.confidence })

    const priorTurns = session.turns.slice(-VOICE_HISTORY_LIMIT).map((turn) => VoiceContextTurnSchema.parse({
      turnId: turn.id,
      intentType: turn.intent?.type ?? 'unknown',
      responseStatus: turn.response?.status ?? 'failed',
      occurredAt: turn.completedAt ?? turn.createdAt,
    }))
    const voiceContext = VoiceOperatorContextSchema.parse({
      sessionId: session.id,
      turnId,
      normalizedGoal: input.utterance,
      opportunityId: intent.opportunityId,
      operatorRunId: session.pendingApproval?.operatorRunId ?? null,
      permissions: [...execution.permissions].sort(),
      pendingApprovalReference: session.pendingApproval?.reference ?? null,
      priorTurns,
      requestId: execution.requestId,
      traceId: execution.traceId,
    })
    emit('voice.context.built', 'built', { priorTurnCount: priorTurns.length, historyLimit: VOICE_HISTORY_LIMIT })

    let voiceResponse: VoiceResponse
    let pendingApproval = session.pendingApproval
    if (intent.type === 'cancel') {
      voiceResponse = response({
        status: 'cancelled', text: 'Sesi dibatalkan. Tidak ada aksi baru yang dijalankan.', machineStatus: 'cancelled',
        operatorRunId: session.pendingApproval?.operatorRunId ?? null, actionId: session.pendingApproval?.actionId ?? null,
        approval: { required: false, reference: null }, sideEffectPerformed: false, failureCode: null,
      }, this.responseProvider)
      pendingApproval = null
      emit('voice.session.cancelled', 'cancelled', { actionReplayPrevented: true })
    } else if (intent.type === 'approve_action') {
      if (!session.pendingApproval || intent.pendingApprovalReference !== session.pendingApproval.reference) {
        voiceResponse = response({
          status: 'clarification_required', text: 'Tidak ada approval tertunda yang dapat diidentifikasi. Sebutkan aksi yang ingin disetujui.',
          machineStatus: 'approval_context_missing', operatorRunId: null, actionId: null,
          approval: { required: false, reference: null }, sideEffectPerformed: false, failureCode: 'APPROVAL_CONTEXT_MISSING',
        }, this.responseProvider)
      } else {
        const approval = session.pendingApproval
        operatorRunId = approval.operatorRunId
        emit('voice.action.started', 'executing', { actionId: approval.actionId, actionType: approval.actionType })
        const approvedAt = this.now()
        const action = ActionSchema.parse({
          contractVersion: CONTRACT_VERSION,
          id: approval.actionId,
          opportunityId: approval.opportunityId,
          actionType: approval.actionType,
          description: approval.description,
          status: 'approved',
          riskLevel: 'high',
          requiresApproval: true,
          approvedAt,
          approvedBy: execution.actorReference,
          inputReference: `voice://${session.id}/${turnId}`,
          executionReference: null,
          createdAt: approval.createdAt,
          updatedAt: approvedAt,
        })
        const actionResult = await this.actionService.execute({
          action,
          idempotencyKey: `voice-${approval.actionId}`,
          approval: {
            reference: approval.reference,
            actionId: approval.actionId,
            approvedBy: execution.actorReference,
            approvedAt,
          },
        }, execution)
        voiceResponse = mapActionResponse(actionResult, this.responseProvider)
        voiceResponse = VoiceResponseSchema.parse({ ...voiceResponse, operatorRunId: approval.operatorRunId })
        emit('voice.result.received', actionResult.status, {
          actionId: approval.actionId,
          validated: actionResult.status === 'simulated' || actionResult.status === 'duplicate',
          sideEffectPerformed: false,
        }, actionResult.errorCode)
        if (['simulated', 'duplicate', 'cancelled', 'denied', 'failed', 'unavailable', 'idempotency_conflict', 'timed_out'].includes(actionResult.status)) {
          pendingApproval = null
        }
      }
    } else if (intent.type === 'unknown' || intent.type === 'clarify' || intent.confidence < 0.7) {
      voiceResponse = response({
        status: 'clarification_required', text: 'Saya belum dapat menentukan intent dengan aman. Mohon nyatakan apakah ingin melihat, merangkum, merekomendasikan, menjalankan, atau menyetujui aksi tertentu.',
        machineStatus: 'clarification_required', operatorRunId: null, actionId: null,
        approval: { required: false, reference: null }, sideEffectPerformed: false, failureCode: 'LOW_CONFIDENCE_INTENT',
      }, this.responseProvider)
    } else if (!intent.opportunityId) {
      voiceResponse = response({
        status: 'clarification_required', text: 'Opportunity belum teridentifikasi. Mohon sertakan opportunity yang ingin diproses.',
        machineStatus: 'opportunity_required', operatorRunId: null, actionId: null,
        approval: { required: false, reference: null }, sideEffectPerformed: false, failureCode: 'OPPORTUNITY_REQUIRED',
      }, this.responseProvider)
    } else {
      const requestedTool = intent.type === 'request_action' ? 'external.action.fixture' : 'opportunity.inspect'
      emit('voice.operator.started', 'running', { intentType: intent.type })
      emit('voice.tool.started', 'pending', { toolName: requestedTool })
      const operatorResult = await this.operatorService.run({
        goal: input.utterance,
        opportunityId: intent.opportunityId,
        requestedTool,
      }, execution)
      voiceResponse = mapOperatorResponse(operatorResult, this.responseProvider)
      if (operatorResult.ok) {
        operatorRunId = operatorResult.value.runId
        voiceResponse = VoiceResponseSchema.parse({ ...voiceResponse, operatorRunId })
        if (operatorResult.value.status === 'approval_required') {
          const actionId = `action_${turnId}`
          const reference = operatorResult.value.approval.reference
          if (!reference) throw new Error('OPERATOR_APPROVAL_REFERENCE_MISSING')
          pendingApproval = {
            reference,
            actionId,
            opportunityId: intent.opportunityId,
            actionType: 'external.action.fixture',
            description: 'Execute the deterministic Phase 9 voice fixture without any external side effect.',
            operatorRunId,
            createdAt: this.now(),
          }
          voiceResponse = VoiceResponseSchema.parse({
            ...voiceResponse,
            actionId,
            approval: { required: true, reference },
          })
          emit('voice.approval.required', 'approval_required', { actionId, approvalReference: reference })
        } else {
          emit('voice.result.received', operatorResult.value.status, { validated: operatorResult.value.tool.resultValidationStatus === 'valid' })
        }
      } else {
        emit('voice.result.received', 'failed', { validated: false }, operatorResult.error.code)
      }
    }

    emit('voice.response.ready', voiceResponse.status, {
      machineStatus: voiceResponse.machineStatus,
      approvalRequired: voiceResponse.approval.required,
      sideEffectPerformed: voiceResponse.sideEffectPerformed,
    }, voiceResponse.failureCode)
    const turnStatus = voiceResponse.status === 'approval_required'
      ? 'approval_required'
      : voiceResponse.status === 'cancelled'
        ? 'cancelled'
        : voiceResponse.status === 'failed'
          ? 'failed'
          : 'completed'
    const turn = VoiceTurnSchema.parse({
      id: turnId,
      sessionId: session.id,
      requestId: execution.requestId,
      traceId: execution.traceId,
      status: turnStatus,
      input,
      intent,
      context: { ...voiceContext, operatorRunId },
      response: voiceResponse,
      operatorRunId,
      createdAt: input.receivedAt,
      completedAt: this.now(),
    })
    session = VoiceSessionSchema.parse({
      ...session,
      status: 'active',
      turns: [...session.turns, turn],
      pendingApproval,
      updatedAt: this.now(),
      completedAt: null,
      failureCode: null,
    })
    this.repository.save(session)
    if (voiceResponse.status === 'cancelled') {
      session = this.repository.transition(session.id, 'cancelled', this.now())
    }
    this.log('voice.response.ready', {
      status: voiceResponse.status,
      errorCode: voiceResponse.failureCode ?? undefined,
      data: { sessionId: session.id, turnId, operatorRunId, intentType: intent.type, confidence: intent.confidence },
    })
    return VoiceTurnResultSchema.parse({ session, turn, response: voiceResponse, events })
  }

  interrupt(sessionId: string, context: Pick<VoiceExecutionContext, 'requestId' | 'traceId'>): VoiceSession {
    const session = this.repository.transition(sessionId, 'interrupted', this.now())
    this.log('voice.session.interrupted', {
      status: 'interrupted',
      data: { sessionId, requestId: context.requestId, traceId: context.traceId, asynchronousCancellationGuaranteed: false },
    })
    return session
  }

  cancel(sessionId: string, context: Pick<VoiceExecutionContext, 'requestId' | 'traceId'>): VoiceSession {
    const session = this.repository.transition(sessionId, 'cancelled', this.now())
    this.log('voice.session.cancelled', {
      status: 'cancelled', data: { sessionId, requestId: context.requestId, traceId: context.traceId, actionReplayPrevented: true },
    })
    return session
  }

  complete(sessionId: string): VoiceSession {
    return this.repository.transition(sessionId, 'completed', this.now())
  }
}
