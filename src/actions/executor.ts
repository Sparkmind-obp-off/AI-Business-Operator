import type {
  ActionExecutorDefinition,
  FixtureActionInput,
  FixtureActionResult,
} from './contracts'

export interface ActionExecutorContext {
  requestId: string
  traceId: string
}

export interface ActionExecutor {
  readonly definition: ActionExecutorDefinition
  canExecute(actionType: string): boolean
  execute(input: FixtureActionInput, context: ActionExecutorContext): Promise<unknown>
}

export class DeterministicFixtureActionExecutor implements ActionExecutor {
  readonly definition: ActionExecutorDefinition = {
    name: 'phase8.deterministic-fixture',
    version: '1.0.0',
    actionType: 'external.action.fixture',
    requiredPermissions: ['action.execute'],
    riskLevel: 'high',
    approvalPolicy: 'always',
    timeoutMs: 1_000,
    maxRetries: 0,
    enabled: true,
  }

  canExecute(actionType: string): boolean {
    return actionType === this.definition.actionType
  }

  async execute(input: FixtureActionInput): Promise<FixtureActionResult> {
    return {
      status: 'simulated',
      executionReference: `fixture://actions/${input.actionId}`,
      actionId: input.actionId,
      idempotencyKey: input.idempotencyKey,
      sideEffectPerformed: false,
      synthetic: true,
      message: 'Deterministic fixture execution only; no external side effect occurred.',
    }
  }
}
