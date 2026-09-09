import type { OperatorContext } from './contracts'
import type { RegisteredTool } from './registry'

export interface ToolExecutionContext {
  runId: string
  requestId: string
  traceId: string
  operatorContext: OperatorContext
}

export interface ToolExecutor {
  invoke(tool: RegisteredTool, validatedInput: unknown, context: ToolExecutionContext): Promise<unknown>
}

export class Session6FixtureToolExecutor implements ToolExecutor {
  async invoke(tool: RegisteredTool, validatedInput: unknown, context: ToolExecutionContext): Promise<unknown> {
    if (tool.definition.name !== 'opportunity.inspect') {
      throw new Error('Executor cannot invoke unapproved or unsupported tools.')
    }
    const input = tool.inputSchema.parse(validatedInput) as { opportunityId: string }
    if (input.opportunityId !== context.operatorContext.opportunity.id) {
      throw new Error('Tool target is outside the bounded Operator context.')
    }
    return {
      opportunityId: context.operatorContext.opportunity.id,
      scoreId: context.operatorContext.score.id,
      evidenceReferences: context.operatorContext.evidence.references,
      status: 'inspected',
    }
  }
}
