import type { Context } from 'hono'
import { CONTRACT_VERSION, ActionSchema } from '../domain'
import { createSession6ToolRegistry } from '../operator'
import { loadConfig, type RuntimeEnvironment } from '../shared/config'
import { createLogger, type CorrelationContext } from '../shared/logger'
import { DeterministicFixtureActionExecutor } from './executor'
import type { ActionExecutionRepository } from './repository'
import { ActionExecutionService } from './service'

type ActionFixtureContext = Context<{
  Bindings: RuntimeEnvironment
  Variables: { correlation: CorrelationContext }
}>

const FIXTURE_TIME = '2026-09-09T12:00:00.000Z'

export function createActionExecutionFixtureHandler(repository: ActionExecutionRepository) {
  return async (c: ActionFixtureContext) => {
    const correlation = c.get('correlation')
    const config = loadConfig(c.env)
    const logger = createLogger(config.public.environment, correlation)
    const action = ActionSchema.parse({
      contractVersion: CONTRACT_VERSION,
      id: 'action_phase8_fixture_001',
      opportunityId: 'opportunity_phase8_fixture_001',
      actionType: 'external.action.fixture',
      description: 'Execute the deterministic Phase 8 fixture without any external side effect.',
      status: 'approved',
      riskLevel: 'high',
      requiresApproval: true,
      approvedAt: FIXTURE_TIME,
      approvedBy: 'fixture_user',
      inputReference: 'fixture://actions/input/action_phase8_fixture_001',
      executionReference: null,
      createdAt: FIXTURE_TIME,
      updatedAt: FIXTURE_TIME,
    })
    const result = await new ActionExecutionService({
      repository,
      toolRegistry: createSession6ToolRegistry(),
      executor: new DeterministicFixtureActionExecutor(),
      now: () => FIXTURE_TIME,
      log: (eventName, fields) => logger(fields.errorCode ? 'warn' : 'info', eventName, fields),
    }).execute({
      action,
      idempotencyKey: 'phase8-fixture-execution-001',
      approval: {
        reference: 'approval://fixture/action_phase8_fixture_001',
        actionId: action.id,
        approvedBy: action.approvedBy,
        approvedAt: action.approvedAt,
      },
    }, { ...correlation, permissions: new Set(['action.execute']) })

    return c.json({
      data: result,
      auditEvents: repository.listAuditEvents(action.id),
      fixture: {
        synthetic: true,
        sideEffectPerformed: false,
        warning: 'No live external action was performed.',
      },
    })
  }
}
