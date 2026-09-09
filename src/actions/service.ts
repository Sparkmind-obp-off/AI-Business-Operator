import {
  ActionOutcomeSchema,
  ActionSchema,
  AuditEventSchema,
  CONTRACT_VERSION,
  type Action,
  type ActionOutcome,
  type AuditEvent,
} from '../domain'
import { idFromHash, sha256 } from '../ingestion/deterministic'
import { evaluateToolPolicy, type ToolRegistry } from '../operator'
import {
  ACTION_EXECUTION_VERSION,
  ActionExecutionRecordSchema,
  ActionExecutionRequestSchema,
  ActionExecutionResponseSchema,
  ActionExecutorDefinitionSchema,
  FixtureActionInputSchema,
  FixtureActionResultSchema,
  type ActionExecutionRecord,
  type ActionExecutionResponse,
} from './contracts'
import type { ActionExecutor } from './executor'
import type { ActionExecutionRepository } from './repository'

export interface ActionExecutionContext {
  requestId: string
  traceId: string
  permissions: ReadonlySet<string>
}

export type ActionLog = (
  eventName: string,
  fields: { status: string; durationMs?: number; errorCode?: string; data?: Record<string, unknown> },
) => void

export interface ActionExecutionServiceOptions {
  repository: ActionExecutionRepository
  toolRegistry: ToolRegistry
  executor: ActionExecutor
  now?: () => string
  clock?: () => number
  log?: ActionLog
}

const terminalStatuses = new Set<Action['status']>(['completed', 'rejected', 'failed', 'cancelled'])
const sensitiveKey = /(authorization|cookie|password|secret|token|api[-_]?key)/i
const sensitiveValue = /(Bearer\s+[A-Za-z0-9._~+/=-]+|\bsk-[A-Za-z0-9_-]{8,}\b)/i

function containsSensitiveData(value: unknown): boolean {
  if (typeof value === 'string') return sensitiveValue.test(value)
  if (Array.isArray(value)) return value.some(containsSensitiveData)
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([key, child]) => sensitiveKey.test(key) || containsSensitiveData(child))
  }
  return false
}

function safeResponse(value: ActionExecutionResponse): ActionExecutionResponse {
  return ActionExecutionResponseSchema.parse(value)
}

export class ActionExecutionService {
  private readonly repository: ActionExecutionRepository
  private readonly toolRegistry: ToolRegistry
  private readonly executor: ActionExecutor
  private readonly now: () => string
  private readonly clock: () => number
  private readonly log: ActionLog

  constructor(options: ActionExecutionServiceOptions) {
    this.repository = options.repository
    this.toolRegistry = options.toolRegistry
    ActionExecutorDefinitionSchema.parse(options.executor.definition)
    this.executor = options.executor
    this.now = options.now ?? (() => new Date().toISOString())
    this.clock = options.clock ?? Date.now
    this.log = options.log ?? (() => undefined)
  }

  async execute(inputValue: unknown, context: ActionExecutionContext): Promise<ActionExecutionResponse> {
    const startedAt = this.clock()
    const containsSensitiveInput = containsSensitiveData(inputValue)
    const parsed = ActionExecutionRequestSchema.safeParse(inputValue)
    if (!parsed.success || containsSensitiveInput) {
      this.log('action.rejected', {
        status: 'invalid',
        errorCode: containsSensitiveInput ? 'SENSITIVE_INPUT_REJECTED' : 'INVALID_ACTION',
      })
      const fallback = containsSensitiveInput
        ? { success: false as const }
        : ActionSchema.safeParse((inputValue as { action?: unknown } | null)?.action)
      return safeResponse({
        status: 'denied', action: fallback.success ? fallback.data : null, outcome: null, executor: null,
        approval: { required: fallback.success ? fallback.data.requiresApproval : false, reference: null },
        duplicate: false, retryable: false,
        errorCode: containsSensitiveInput ? 'SENSITIVE_INPUT_REJECTED' : 'INVALID_ACTION',
        persistence: 'process_local_memory',
      })
    }

    const request = parsed.data
    const originalAction = request.action
    const auditEvents: AuditEvent[] = []
    let auditSequence = this.repository.listAuditEvents(originalAction.id).length
    const audit = (eventName: string, resultStatus: AuditEvent['resultStatus'], metadata: Record<string, unknown> = {}) => {
      auditSequence += 1
      const event = AuditEventSchema.parse({
        contractVersion: CONTRACT_VERSION,
        id: `action_audit_${auditSequence}_${originalAction.id.slice(-48)}`,
        occurredAt: this.now(),
        actorType: 'system',
        actorReference: ACTION_EXECUTION_VERSION,
        entityType: 'action',
        entityId: originalAction.id,
        eventName,
        requestId: context.requestId,
        traceId: context.traceId,
        runId: null,
        metadata,
        resultStatus,
      })
      auditEvents.push(event)
      this.repository.appendAudit(originalAction.id, event)
    }
    const executorIdentity = { name: this.executor.definition.name, version: this.executor.definition.version }
    const respond = (value: Omit<ActionExecutionResponse, 'persistence'>) => safeResponse({
      ...value,
      persistence: 'process_local_memory',
    })

    audit('action.requested', 'success', { actionType: originalAction.actionType, riskLevel: originalAction.riskLevel })

    const tool = this.toolRegistry.resolve(originalAction.actionType)
    if (!tool) {
      audit('action.rejected', 'denied', { errorCode: 'ACTION_UNREGISTERED' })
      this.log('action.rejected', {
        status: 'denied', errorCode: 'ACTION_UNREGISTERED',
        data: { actionId: originalAction.id, actionType: originalAction.actionType },
      })
      return respond({
        status: 'unavailable', action: { ...originalAction, status: 'rejected', updatedAt: this.now() },
        outcome: null, executor: null, approval: { required: originalAction.requiresApproval, reference: null },
        duplicate: false, retryable: false, errorCode: 'ACTION_UNREGISTERED',
      })
    }

    const policy = evaluateToolPolicy(tool, context.permissions)
    audit('action.permission_checked', policy.permissionDecision === 'denied' ? 'denied' : 'success', {
      toolName: tool.definition.name,
      toolVersion: tool.definition.version,
      riskLevel: tool.definition.riskLevel,
      decision: policy.permissionDecision,
    })

    if (policy.permissionDecision === 'denied') {
      audit('action.rejected', 'denied', { errorCode: 'PERMISSION_DENIED' })
      return respond({
        status: tool.definition.enabled ? 'denied' : 'unavailable',
        action: { ...originalAction, status: 'rejected', updatedAt: this.now() }, outcome: null,
        executor: executorIdentity, approval: { required: originalAction.requiresApproval, reference: null },
        duplicate: false, retryable: false, errorCode: 'PERMISSION_DENIED',
      })
    }

    const policyRequiresApproval = policy.permissionDecision === 'approval_required'
    if (originalAction.riskLevel !== tool.definition.riskLevel
      || originalAction.requiresApproval !== policyRequiresApproval) {
      audit('action.rejected', 'denied', { errorCode: 'RISK_POLICY_MISMATCH' })
      return respond({
        status: 'denied', action: { ...originalAction, status: 'rejected', updatedAt: this.now() },
        outcome: null, executor: executorIdentity,
        approval: { required: policyRequiresApproval, reference: null }, duplicate: false,
        retryable: false, errorCode: 'RISK_POLICY_MISMATCH',
      })
    }

    if (terminalStatuses.has(originalAction.status)) {
      audit('action.rejected', 'denied', { errorCode: 'INVALID_ACTION_STATE', status: originalAction.status })
      return respond({
        status: originalAction.status === 'cancelled' ? 'cancelled' : 'denied', action: originalAction,
        outcome: null, executor: executorIdentity,
        approval: { required: policyRequiresApproval, reference: request.approval?.reference ?? null },
        duplicate: false, retryable: false, errorCode: 'INVALID_ACTION_STATE',
      })
    }

    if (policyRequiresApproval) {
      const approval = request.approval
      const validApproval = approval
        && approval.actionId === originalAction.id
        && originalAction.status === 'approved'
        && originalAction.approvedAt === approval.approvedAt
        && originalAction.approvedBy === approval.approvedBy
      if (!validApproval) {
        const action = ActionSchema.parse({ ...originalAction, status: 'awaiting_approval', updatedAt: this.now() })
        audit('action.approval_required', 'denied', { toolName: tool.definition.name })
        this.log('action.approval_required', {
          status: 'approval_required',
          data: { actionId: action.id, opportunityId: action.opportunityId, riskLevel: action.riskLevel },
        })
        return respond({
          status: 'approval_required', action, outcome: null, executor: executorIdentity,
          approval: { required: true, reference: null }, duplicate: false, retryable: false,
          errorCode: 'APPROVAL_REQUIRED',
        })
      }
      audit('action.approved', 'success', { approvalReference: approval.reference, approvedBy: approval.approvedBy })
    }

    const fixtureInput = FixtureActionInputSchema.parse({
      actionId: originalAction.id,
      opportunityId: originalAction.opportunityId,
      description: originalAction.description,
      idempotencyKey: request.idempotencyKey,
    })
    const inputHash = await sha256({ action: originalAction, fixtureInput })
    const existingByKey = this.repository.findByIdempotencyKey(request.idempotencyKey)
    const existingByAction = this.repository.findByActionId(originalAction.id)
    const existing = existingByKey ?? existingByAction
    if (existing) {
      if (existing.idempotencyKey === request.idempotencyKey && existing.inputHash === inputHash) {
        audit('action.duplicate_detected', 'success', { inputHash })
        this.log('action.duplicate_detected', {
          status: 'duplicate', data: { actionId: originalAction.id, inputHash },
        })
        return respond({
          status: 'duplicate', action: existing.action, outcome: existing.outcome,
          executor: { name: existing.executorName, version: existing.executorVersion },
          approval: { required: originalAction.requiresApproval, reference: existing.approvalReference },
          duplicate: true, retryable: existing.retryable, errorCode: existing.errorCode,
        })
      }
      audit('action.idempotency_conflict', 'denied', { inputHash })
      this.log('action.idempotency_conflict', {
        status: 'conflict', errorCode: 'IDEMPOTENCY_CONFLICT', data: { actionId: originalAction.id, inputHash },
      })
      return respond({
        status: 'idempotency_conflict', action: originalAction, outcome: null, executor: executorIdentity,
        approval: { required: originalAction.requiresApproval, reference: request.approval?.reference ?? null },
        duplicate: false, retryable: false, errorCode: 'IDEMPOTENCY_CONFLICT',
      })
    }

    if (!this.executor.definition.enabled || !this.executor.canExecute(originalAction.actionType)) {
      audit('action.rejected', 'denied', { errorCode: 'EXECUTOR_UNAVAILABLE' })
      return respond({
        status: 'unavailable', action: { ...originalAction, status: 'failed', updatedAt: this.now() },
        outcome: null, executor: executorIdentity,
        approval: { required: originalAction.requiresApproval, reference: request.approval?.reference ?? null },
        duplicate: false, retryable: false, errorCode: 'EXECUTOR_UNAVAILABLE',
      })
    }

    const executingAction = ActionSchema.parse({ ...originalAction, status: 'executing', updatedAt: this.now() })
    audit('action.execution_started', 'success', {
      executorName: this.executor.definition.name,
      executorVersion: this.executor.definition.version,
      inputHash,
    })
    this.log('action.execution_started', {
      status: 'executing',
      data: { actionId: originalAction.id, opportunityId: originalAction.opportunityId, executorName: this.executor.definition.name },
    })

    let executorResult: unknown
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined
    try {
      const timeout = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error('ACTION_EXECUTOR_TIMEOUT')), this.executor.definition.timeoutMs)
      })
      executorResult = await Promise.race([
        this.executor.execute(fixtureInput, { requestId: context.requestId, traceId: context.traceId }),
        timeout,
      ])
    } catch (error) {
      const timedOut = error instanceof Error && error.message === 'ACTION_EXECUTOR_TIMEOUT'
      return this.recordFailure({
        action: executingAction,
        idempotencyKey: request.idempotencyKey,
        inputHash,
        approvalReference: request.approval?.reference ?? null,
        auditEvents,
        audit,
        context,
        startedAt,
        errorCode: timedOut ? 'EXECUTOR_TIMEOUT' : 'EXECUTOR_FAILURE',
        retryable: timedOut,
      })
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle)
    }

    const result = FixtureActionResultSchema.safeParse(executorResult)
    if (!result.success
      || result.data.actionId !== originalAction.id
      || result.data.idempotencyKey !== request.idempotencyKey
      || result.data.sideEffectPerformed !== false) {
      audit('action.result_validated', 'failure', { errorCode: 'INVALID_EXECUTOR_RESULT' })
      return this.recordFailure({
        action: executingAction,
        idempotencyKey: request.idempotencyKey,
        inputHash,
        approvalReference: request.approval?.reference ?? null,
        auditEvents,
        audit,
        context,
        startedAt,
        errorCode: 'INVALID_EXECUTOR_RESULT',
        retryable: false,
      })
    }

    audit('action.result_validated', 'success', {
      executionReference: result.data.executionReference,
      sideEffectPerformed: false,
      synthetic: true,
    })
    const completedAction = ActionSchema.parse({
      ...executingAction,
      status: 'completed',
      executionReference: result.data.executionReference,
      updatedAt: this.now(),
    })
    const outcome = ActionOutcomeSchema.parse({
      contractVersion: CONTRACT_VERSION,
      id: idFromHash('action_outcome', inputHash),
      actionId: completedAction.id,
      outcomeType: 'succeeded',
      result: result.data.message,
      metrics: { executionStatus: 'simulated', synthetic: true, sideEffectPerformed: false },
      externalReference: result.data.executionReference,
      observedAt: this.now(),
    })
    audit('action.execution_succeeded', 'success', {
      executionReference: result.data.executionReference,
      durationMs: this.clock() - startedAt,
      sideEffectPerformed: false,
    })
    const record = this.saveRecord({
      action: completedAction,
      outcome,
      idempotencyKey: request.idempotencyKey,
      inputHash,
      approvalReference: request.approval?.reference ?? null,
      retryable: false,
      errorCode: null,
      auditEvents,
    })
    this.log('action.execution_succeeded', {
      status: 'simulated', durationMs: this.clock() - startedAt,
      data: { actionId: originalAction.id, opportunityId: originalAction.opportunityId, executorName: this.executor.definition.name, sideEffectPerformed: false },
    })
    return respond({
      status: 'simulated', action: record.action, outcome: record.outcome, executor: executorIdentity,
      approval: { required: originalAction.requiresApproval, reference: record.approvalReference },
      duplicate: false, retryable: false, errorCode: null,
    })
  }

  private recordFailure(options: {
    action: Action
    idempotencyKey: string
    inputHash: string
    approvalReference: string | null
    auditEvents: AuditEvent[]
    audit: (eventName: string, resultStatus: AuditEvent['resultStatus'], metadata?: Record<string, unknown>) => void
    context: ActionExecutionContext
    startedAt: number
    errorCode: string
    retryable: boolean
  }): ActionExecutionResponse {
    const failedAction = ActionSchema.parse({ ...options.action, status: 'failed', updatedAt: this.now() })
    const outcome: ActionOutcome = ActionOutcomeSchema.parse({
      contractVersion: CONTRACT_VERSION,
      id: idFromHash('action_outcome', options.inputHash),
      actionId: failedAction.id,
      outcomeType: 'failed',
      result: 'Fixture action execution failed safely; no external side effect is claimed.',
      metrics: { sideEffectPerformed: false, retryable: options.retryable, errorCode: options.errorCode },
      externalReference: null,
      observedAt: this.now(),
    })
    options.audit('action.execution_failed', 'failure', {
      errorCode: options.errorCode,
      retryable: options.retryable,
      durationMs: this.clock() - options.startedAt,
    })
    const record = this.saveRecord({
      action: failedAction,
      outcome,
      idempotencyKey: options.idempotencyKey,
      inputHash: options.inputHash,
      approvalReference: options.approvalReference,
      retryable: options.retryable,
      errorCode: options.errorCode,
      auditEvents: options.auditEvents,
    })
    this.log('action.execution_failed', {
      status: options.errorCode === 'EXECUTOR_TIMEOUT' ? 'timed_out' : 'failed',
      durationMs: this.clock() - options.startedAt,
      errorCode: options.errorCode,
      data: { actionId: options.action.id, executorName: this.executor.definition.name, retryable: options.retryable },
    })
    return safeResponse({
      status: options.errorCode === 'EXECUTOR_TIMEOUT' ? 'timed_out' : 'failed',
      action: record.action,
      outcome: record.outcome,
      executor: { name: record.executorName, version: record.executorVersion },
      approval: { required: record.action.requiresApproval, reference: record.approvalReference },
      duplicate: false,
      retryable: record.retryable,
      errorCode: record.errorCode,
      persistence: 'process_local_memory',
    })
  }

  private saveRecord(input: {
    action: Action
    outcome: ActionOutcome
    idempotencyKey: string
    inputHash: string
    approvalReference: string | null
    retryable: boolean
    errorCode: string | null
    auditEvents: AuditEvent[]
  }): ActionExecutionRecord {
    const record = ActionExecutionRecordSchema.parse({
      version: ACTION_EXECUTION_VERSION,
      ...input,
      executorName: this.executor.definition.name,
      executorVersion: this.executor.definition.version,
      persistence: 'process_local_memory',
    })
    this.repository.save(record)
    return record
  }
}
