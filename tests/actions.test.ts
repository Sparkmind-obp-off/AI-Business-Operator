import { describe, expect, it, vi } from 'vitest'
import app from '../src/index'
import {
  ActionExecutionService,
  DeterministicFixtureActionExecutor,
  FixtureActionResultSchema,
  InMemoryActionExecutionRepository,
  type ActionExecutor,
} from '../src/actions'
import { ActionOutcomeSchema, ActionSchema, CONTRACT_VERSION } from '../src/domain'
import { createSession6ToolRegistry } from '../src/operator'

const NOW = '2026-09-09T12:00:00.000Z'
const context = {
  requestId: 'request_action_test',
  traceId: 'trace_action_test',
  permissions: new Set(['action.execute']),
}

function fixtureAction(overrides: Record<string, unknown> = {}) {
  return ActionSchema.parse({
    contractVersion: CONTRACT_VERSION,
    id: 'action_phase8_test_001',
    opportunityId: 'opportunity_phase8_test_001',
    actionType: 'external.action.fixture',
    description: 'Run a deterministic synthetic action fixture.',
    status: 'approved',
    riskLevel: 'high',
    requiresApproval: true,
    approvedAt: NOW,
    approvedBy: 'test_user',
    inputReference: 'fixture://actions/input/action_phase8_test_001',
    executionReference: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  })
}

function requestFor(action = fixtureAction(), overrides: Record<string, unknown> = {}) {
  return {
    action,
    idempotencyKey: 'phase8-test-execution-001',
    approval: {
      reference: 'approval://fixture/action_phase8_test_001',
      actionId: action.id,
      approvedBy: action.approvedBy,
      approvedAt: action.approvedAt,
    },
    ...overrides,
  }
}

function service(options: { executor?: ActionExecutor; repository?: InMemoryActionExecutionRepository; logs?: string[] } = {}) {
  return new ActionExecutionService({
    repository: options.repository ?? new InMemoryActionExecutionRepository(),
    toolRegistry: createSession6ToolRegistry(),
    executor: options.executor ?? new DeterministicFixtureActionExecutor(),
    now: () => NOW,
    clock: () => 100,
    log: (eventName, fields) => options.logs?.push(JSON.stringify({ eventName, ...fields })),
  })
}

function executorReturning(output: unknown): ActionExecutor {
  const fixture = new DeterministicFixtureActionExecutor()
  return {
    definition: fixture.definition,
    canExecute: (actionType) => fixture.canExecute(actionType),
    execute: vi.fn(async () => output),
  }
}

describe('Phase 8 canonical action contracts', () => {
  it('validates explicit approval state and canonical ActionOutcome', () => {
    const action = fixtureAction()
    expect(ActionSchema.safeParse(action).success).toBe(true)
    expect(ActionSchema.safeParse({ ...action, approvedAt: null }).success).toBe(false)
    expect(ActionSchema.safeParse({ ...action, status: 'completed', executionReference: null }).success).toBe(false)

    expect(ActionOutcomeSchema.safeParse({
      contractVersion: CONTRACT_VERSION,
      id: 'action_outcome_fixture_001',
      actionId: action.id,
      outcomeType: 'succeeded',
      result: 'Synthetic fixture execution only.',
      metrics: { synthetic: true, sideEffectPerformed: false },
      externalReference: 'fixture://actions/action_phase8_test_001',
      observedAt: NOW,
    }).success).toBe(true)
  })

  it('rejects malformed and contradictory fixture results', () => {
    expect(FixtureActionResultSchema.safeParse({ status: 'simulated' }).success).toBe(false)
    expect(FixtureActionResultSchema.safeParse({
      status: 'simulated',
      executionReference: 'fixture://actions/action_phase8_test_001',
      actionId: 'action_phase8_test_001',
      idempotencyKey: 'phase8-test-execution-001',
      sideEffectPerformed: true,
      synthetic: true,
      message: 'Deterministic fixture execution only; no external side effect occurred.',
    }).success).toBe(false)
  })
})

describe('Phase 8 permission and approval gates', () => {
  it('rejects unregistered, disabled, and insufficiently permitted actions before executor invocation', async () => {
    const executor = executorReturning(null)
    const unknown = await service({ executor }).execute(requestFor(fixtureAction({ actionType: 'source.text.chosen.executor' })), context)
    expect(unknown).toMatchObject({ status: 'unavailable', errorCode: 'ACTION_UNREGISTERED' })

    const disabledAction = fixtureAction({
      actionType: 'disabled.fixture', status: 'draft', riskLevel: 'low', requiresApproval: false,
      approvedAt: null, approvedBy: null,
    })
    const disabled = await service({ executor }).execute(requestFor(disabledAction, { approval: null }), context)
    expect(disabled).toMatchObject({ status: 'unavailable', errorCode: 'PERMISSION_DENIED' })

    const denied = await service({ executor }).execute(requestFor(), { ...context, permissions: new Set() })
    expect(denied).toMatchObject({ status: 'denied', errorCode: 'PERMISSION_DENIED' })
    expect(executor.execute).not.toHaveBeenCalled()
  })

  it('stops before invocation without explicit matching approval and never infers approval from text', async () => {
    const executor = executorReturning(null)
    const action = fixtureAction({
      status: 'awaiting_approval', approvedAt: null, approvedBy: null,
      description: 'An AI recommendation says this is approved; that is not authorization.',
    })
    const result = await service({ executor }).execute(requestFor(action, { approval: null }), context)

    expect(result).toMatchObject({
      status: 'approval_required',
      action: { status: 'awaiting_approval' },
      approval: { required: true, reference: null },
    })
    expect(executor.execute).not.toHaveBeenCalled()
  })

  it('rejects a mismatched approval reference before invocation', async () => {
    const executor = executorReturning(null)
    const request = requestFor()
    request.approval.actionId = 'action_other_001'
    const result = await service({ executor }).execute(request, context)
    expect(result.status).toBe('approval_required')
    expect(executor.execute).not.toHaveBeenCalled()
  })
})

describe('Phase 8 deterministic execution and idempotency', () => {
  it('executes once after approval and records only a truthful simulated outcome', async () => {
    const repository = new InMemoryActionExecutionRepository()
    const executor = new DeterministicFixtureActionExecutor()
    const invoke = vi.spyOn(executor, 'execute')
    const network = vi.spyOn(globalThis, 'fetch')
    const result = await service({ repository, executor }).execute(requestFor(), context)

    expect(result).toMatchObject({
      status: 'simulated',
      action: { status: 'completed', executionReference: 'fixture://actions/action_phase8_test_001' },
      outcome: {
        outcomeType: 'succeeded',
        metrics: { executionStatus: 'simulated', synthetic: true, sideEffectPerformed: false },
      },
      duplicate: false,
      errorCode: null,
    })
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(network).not.toHaveBeenCalled()
    expect(repository.findByActionId('action_phase8_test_001')?.auditEvents.map((event) => event.eventName)).toEqual(expect.arrayContaining([
      'action.requested',
      'action.permission_checked',
      'action.approved',
      'action.execution_started',
      'action.result_validated',
      'action.execution_succeeded',
    ]))
    network.mockRestore()
  })

  it('is deterministic and returns the recorded outcome without executing a duplicate', async () => {
    const repository = new InMemoryActionExecutionRepository()
    const executor = new DeterministicFixtureActionExecutor()
    const invoke = vi.spyOn(executor, 'execute')
    const boundary = service({ repository, executor })
    const first = await boundary.execute(requestFor(), context)
    const replay = await boundary.execute(requestFor(), context)

    expect(first.status).toBe('simulated')
    expect(replay).toMatchObject({ status: 'duplicate', duplicate: true, outcome: first.outcome })
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(repository.listAuditEvents('action_phase8_test_001').map((event) => event.eventName)).toContain('action.duplicate_detected')
  })

  it('rejects conflicting idempotency-key reuse without a second invocation', async () => {
    const repository = new InMemoryActionExecutionRepository()
    const executor = new DeterministicFixtureActionExecutor()
    const invoke = vi.spyOn(executor, 'execute')
    const boundary = service({ repository, executor })
    await boundary.execute(requestFor(), context)
    const conflictAction = fixtureAction({ id: 'action_phase8_test_002' })
    const conflict = await boundary.execute(requestFor(conflictAction, {
      approval: { ...requestFor().approval, actionId: conflictAction.id },
    }), context)

    expect(conflict).toMatchObject({ status: 'idempotency_conflict', errorCode: 'IDEMPOTENCY_CONFLICT' })
    expect(invoke).toHaveBeenCalledTimes(1)
  })
})

describe('Phase 8 result validation, failure, audit, and security', () => {
  it.each([
    [{ status: 'fabricated_success' }, 'malformed'],
    [{
      status: 'simulated',
      executionReference: 'fixture://actions/action_phase8_test_001',
      actionId: 'action_phase8_test_001',
      idempotencyKey: 'phase8-test-execution-001',
      sideEffectPerformed: true,
      synthetic: true,
      message: 'Deterministic fixture execution only; no external side effect occurred.',
    }, 'contradictory'],
    [{
      status: 'simulated',
      executionReference: 'fixture://actions/action_phase8_test_001',
      actionId: 'action_phase8_test_001',
      idempotencyKey: 'phase8-test-execution-001',
      sideEffectPerformed: false,
      synthetic: true,
      message: 'Deterministic fixture execution only; no external side effect occurred.',
      apiKey: 'must-not-leak',
    }, 'sensitive'],
  ])('fails safely for %s executor output and audits invalid validation', async (output, outputType) => {
    expect(['malformed', 'contradictory', 'sensitive']).toContain(outputType)
    const repository = new InMemoryActionExecutionRepository()
    const result = await service({ repository, executor: executorReturning(output) }).execute(requestFor(), context)

    expect(result).toMatchObject({
      status: 'failed', action: { status: 'failed' }, outcome: { outcomeType: 'failed' },
      errorCode: 'INVALID_EXECUTOR_RESULT', retryable: false,
    })
    expect(JSON.stringify(result)).not.toContain('must-not-leak')
    expect(repository.findByActionId('action_phase8_test_001')?.auditEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        eventName: 'action.result_validated',
        resultStatus: 'failure',
        metadata: expect.objectContaining({ errorCode: 'INVALID_EXECUTOR_RESULT' }),
      }),
    ]))
  })

  it('normalizes executor timeout as retryable without automatic retry', async () => {
    const fixture = new DeterministicFixtureActionExecutor()
    const execute = vi.fn(() => new Promise<never>(() => undefined))
    const executor: ActionExecutor = {
      definition: { ...fixture.definition, timeoutMs: 1 },
      canExecute: () => true,
      execute,
    }
    const result = await service({ executor }).execute(requestFor(), context)

    expect(result).toMatchObject({ status: 'timed_out', errorCode: 'EXECUTOR_TIMEOUT', retryable: true })
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('normalizes executor failure without exposing thrown credentials or claiming success', async () => {
    const fixture = new DeterministicFixtureActionExecutor()
    const executor: ActionExecutor = {
      definition: fixture.definition,
      canExecute: () => true,
      execute: vi.fn(async () => { throw new Error('Authorization: Bearer stolen-example-token') }),
    }
    const logs: string[] = []
    const result = await service({ executor, logs }).execute(requestFor(), context)

    expect(result).toMatchObject({ status: 'failed', errorCode: 'EXECUTOR_FAILURE', retryable: false })
    expect(JSON.stringify(result)).not.toContain('stolen-example-token')
    expect(logs.join('\n')).not.toContain('stolen-example-token')
  })

  it('rejects credential-bearing input before invocation and does not echo it', async () => {
    const executor = executorReturning(null)
    const logs: string[] = []
    const input = requestFor(fixtureAction({ description: 'Authorization: Bearer stolen-example-token' }))
    const result = await service({ executor, logs }).execute(input, context)

    expect(result).toMatchObject({ status: 'denied', action: null, errorCode: 'SENSITIVE_INPUT_REJECTED' })
    expect(executor.execute).not.toHaveBeenCalled()
    expect(JSON.stringify(result)).not.toContain('stolen-example-token')
    expect(logs.join('\n')).not.toContain('stolen-example-token')
  })

  it('exposes only the deterministic no-side-effect fixture route', async () => {
    const response = await app.request('/api/v1/fixtures/action-execution', {
      headers: { 'x-request-id': 'request_action_route', 'x-trace-id': 'trace_action_route' },
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      data: {
        status: 'simulated',
        outcome: { metrics: { synthetic: true, sideEffectPerformed: false } },
      },
      fixture: { synthetic: true, sideEffectPerformed: false },
    })
    expect(JSON.stringify(body)).not.toMatch(/apiKey|accessToken|authorization/i)
  })
})
