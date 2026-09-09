import {
  AuditEventSchema,
  CONTRACT_VERSION,
  OperatorRunSchema,
  ToolCallSchema,
  type AuditEvent,
  type ToolCall,
} from '../domain'
import { idFromHash, sha256 } from '../ingestion/deterministic'
import type { OpportunityRepository } from '../opportunities'
import type { ScoreRepository } from '../scoring'
import { failure, success, type Result } from '../shared/result'
import {
  OPERATOR_VERSION,
  OperatorContextSchema,
  OperatorGoalSchema,
  OperatorPlanSchema,
  OperatorResultSchema,
  OperatorRunRecordSchema,
  type OperatorContext,
  type OperatorGoal,
  type OperatorPlan,
  type OperatorResult,
} from './contracts'
import type { ToolExecutor } from './executor'
import type { OperatorRepository } from './repository'
import { evaluateToolPolicy, type ToolRegistry } from './registry'

export interface OperatorExecutionContext {
  requestId: string
  traceId: string
  permissions: ReadonlySet<string>
}

export type OperatorLog = (
  eventName: string,
  fields: { status: string; errorCode?: string; data?: Record<string, unknown> },
) => void

export interface OperatorServiceOptions {
  opportunityRepository: OpportunityRepository
  scoreRepository: ScoreRepository
  operatorRepository: OperatorRepository
  toolRegistry: ToolRegistry
  toolExecutor: ToolExecutor
  now?: () => string
  log?: OperatorLog
}

function buildContext(
  opportunityRepository: OpportunityRepository,
  scoreRepository: ScoreRepository,
  opportunityId: string,
): Result<OperatorContext> {
  const record = opportunityRepository.findById(opportunityId)
  if (!record) return failure('NOT_FOUND', 'Opportunity was not found.')
  const score = scoreRepository.findLatestByOpportunityId(opportunityId)
  if (!score) return failure('NOT_FOUND', 'A current Opportunity score is unavailable.')
  if (record.opportunity.currentScore !== score.score.totalScore
    || record.opportunity.scoreVersion !== score.score.scoreVersion
    || score.score.opportunityId !== opportunityId) {
    return failure('VALIDATION_FAILED', 'Opportunity score references are inconsistent.')
  }

  const stale = score.breakdown.some((component) => component.freshnessModifier <= 0.4)
  const unknowns: string[] = score.breakdown
    .filter((component) => component.evidenceStatus === 'unknown')
    .map((component) => component.dimension)
  if (record.opportunity.offerHypothesis === 'unknown') unknowns.push('offerHypothesis')
  if (record.opportunity.segment === 'unknown') unknowns.push('segment')

  const parsed = OperatorContextSchema.safeParse({
    opportunity: {
      id: record.opportunity.id,
      status: record.opportunity.status,
      title: record.opportunity.title,
      offerHypothesis: record.opportunity.offerHypothesis,
      segment: record.opportunity.segment,
      confidence: record.opportunity.confidence,
      demandIds: record.opportunity.demandIds,
    },
    score: {
      id: score.score.id,
      version: score.score.scoreVersion,
      total: score.score.totalScore,
      band: score.band,
      state: stale ? 'stale' : 'current',
      breakdown: score.breakdown,
    },
    evidence: {
      references: score.evidenceReferences,
      sources: record.sourceReferences,
      provenance: record.provenance,
    },
    unknowns: [...new Set(unknowns)].sort(),
  })
  return parsed.success
    ? success(parsed.data)
    : failure('VALIDATION_FAILED', 'Operator context did not satisfy its bounded contract.')
}

export function createDeterministicPlan(goal: OperatorGoal, context: OperatorContext): OperatorPlan {
  const freshnessStep = context.score.state === 'stale'
    ? 'Stop before consequential action and recommend refreshing stale evidence.'
    : 'Review the current score breakdown and its explicit uncertainty.'
  const recommendation = context.score.state === 'stale'
    ? 'Direkomendasikan: refresh the linked evidence before relying on this score for a consequential action.'
    : context.unknowns.length > 0
      ? `Direkomendasikan: validate ${context.unknowns.join(', ')} before qualification or external action.`
      : 'Direkomendasikan: review the linked evidence and prepare the next bounded validation step.'

  return OperatorPlanSchema.parse({
    version: OPERATOR_VERSION,
    steps: [
      `Inspect Opportunity ${context.opportunity.id} and only its linked canonical evidence.`,
      freshnessStep,
      `Use only the explicitly registered tool ${goal.requestedTool ?? 'opportunity.inspect'}.`,
      'Verify permission, risk, schema, and approval policy before invocation.',
      'Validate any tool result and stop before an external side effect requiring approval.',
    ],
    recommendation,
    facts: [
      `Terdeteksi: Opportunity ${context.opportunity.id} links ${context.opportunity.demandIds.length} DemandObject(s).`,
      `Terdeteksi: evidence references remain linked to Score ${context.score.id}.`,
    ],
    derived: [
      `Diperkirakan: deterministic score ${context.score.total} is in the ${context.score.band} band using ${context.score.version}.`,
    ],
    unknowns: context.unknowns,
  })
}

export class OperatorService {
  private readonly options: OperatorServiceOptions
  private readonly now: () => string
  private readonly log: OperatorLog

  constructor(options: OperatorServiceOptions) {
    this.options = options
    this.now = options.now ?? (() => new Date().toISOString())
    this.log = options.log ?? (() => undefined)
  }

  async run(inputValue: unknown, execution: OperatorExecutionContext): Promise<Result<OperatorResult>> {
    const parsed = OperatorGoalSchema.safeParse(inputValue)
    if (!parsed.success) return failure('VALIDATION_FAILED', 'Operator goal did not satisfy its contract.')
    const goal = parsed.data
    const startedAt = this.now()
    const runHash = await sha256({ version: OPERATOR_VERSION, goal, traceId: execution.traceId, startedAt })
    const runId = idFromHash('operator_run', runHash)
    let run = OperatorRunSchema.parse({
      contractVersion: CONTRACT_VERSION,
      id: runId,
      userGoal: goal.goal,
      contextReference: `opportunity:${goal.opportunityId}`,
      planReference: null,
      status: 'running',
      modelProvider: null,
      modelVersion: null,
      startedAt,
      completedAt: null,
      failureCode: null,
    })
    let context: OperatorContext | null = null
    let plan: OperatorPlan | null = null
    const toolCalls: ToolCall[] = []
    const auditEvents: AuditEvent[] = []
    let auditSequence = 0

    const audit = (eventName: string, resultStatus: AuditEvent['resultStatus'], metadata: Record<string, unknown> = {}) => {
      auditSequence += 1
      auditEvents.push(AuditEventSchema.parse({
        contractVersion: CONTRACT_VERSION,
        id: `${runId}_audit_${auditSequence}`,
        occurredAt: this.now(),
        actorType: 'operator',
        actorReference: OPERATOR_VERSION,
        entityType: 'operator_run',
        entityId: runId,
        eventName,
        requestId: execution.requestId,
        traceId: execution.traceId,
        runId,
        metadata,
        resultStatus,
      }))
    }
    const persist = () => this.options.operatorRepository.save(OperatorRunRecordSchema.parse({
      run, context, plan, toolCalls, auditEvents,
    }))
    const finishFailure = (code: 'NOT_FOUND' | 'VALIDATION_FAILED', message: string) => {
      run = OperatorRunSchema.parse({ ...run, status: 'failed', completedAt: this.now(), failureCode: code })
      audit('operator.failed', 'failure', { errorCode: code })
      persist()
      this.log('operator.failed', { status: 'failed', errorCode: code, data: { runId, opportunityId: goal.opportunityId } })
      return failure(code, message)
    }

    audit('operator.started', 'success', { opportunityId: goal.opportunityId })
    persist()
    this.log('operator.started', { status: 'running', data: { runId, opportunityId: goal.opportunityId } })

    const contextResult = buildContext(this.options.opportunityRepository, this.options.scoreRepository, goal.opportunityId)
    if (!contextResult.ok) return finishFailure(contextResult.error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'VALIDATION_FAILED', contextResult.error.message)
    context = contextResult.value
    plan = createDeterministicPlan(goal, context)
    run = OperatorRunSchema.parse({ ...run, planReference: `operator_plan:${runId}` })
    audit('operator.planned', 'success', { scoreId: context.score.id, scoreState: context.score.state })
    persist()

    const toolName = goal.requestedTool ?? 'opportunity.inspect'
    const tool = this.options.toolRegistry.resolve(toolName)
    if (!tool) {
      run = OperatorRunSchema.parse({ ...run, status: 'failed', completedAt: this.now(), failureCode: 'TOOL_UNAVAILABLE' })
      audit('operator.tool_permission_checked', 'denied', { toolName, decision: 'unavailable' })
      audit('operator.failed', 'denied', { errorCode: 'TOOL_UNAVAILABLE' })
      persist()
      return success(OperatorResultSchema.parse({
        runId, status: 'unavailable', plan, recommendation: plan.recommendation,
        approval: { required: false, reason: 'Requested tool is not registered.' },
        tool: { name: toolName, version: 'unknown', permissionDecision: 'denied', invocationStatus: 'not_invoked', resultValidationStatus: 'not_applicable', output: null },
        evidence: context.evidence.references, persistence: 'process_local_memory',
      }))
    }

    const policy = evaluateToolPolicy(tool, execution.permissions)
    const toolCallId = `${runId}_tool_1`
    const toolInput = tool.definition.name === 'external.action.fixture'
      ? { opportunityId: goal.opportunityId, proposedAction: plan.recommendation }
      : { opportunityId: goal.opportunityId }
    const inputResult = tool.inputSchema.safeParse(toolInput)
    if (!inputResult.success) return finishFailure('VALIDATION_FAILED', 'Tool input did not satisfy the registered schema.')
    const inputHash = await sha256(inputResult.data)
    const toolCall = ToolCallSchema.parse({
      contractVersion: CONTRACT_VERSION,
      id: toolCallId,
      operatorRunId: runId,
      toolName: tool.definition.name,
      toolVersion: tool.definition.version,
      inputHash,
      outputReference: null,
      permissionDecision: policy.permissionDecision,
      approvalReference: policy.permissionDecision === 'approval_required' ? `approval:${toolCallId}` : null,
      status: policy.permissionDecision === 'allowed' ? 'pending' : 'denied',
      startedAt: this.now(),
      completedAt: policy.permissionDecision === 'allowed' ? null : this.now(),
      errorCode: policy.permissionDecision === 'denied' ? 'PERMISSION_DENIED' : null,
    })
    toolCalls.push(toolCall)
    audit('operator.tool_permission_checked', policy.permissionDecision === 'allowed' ? 'success' : 'denied', {
      toolName: tool.definition.name,
      toolVersion: tool.definition.version,
      decision: policy.permissionDecision,
      riskLevel: tool.definition.riskLevel,
    })

    if (policy.permissionDecision === 'approval_required') {
      run = OperatorRunSchema.parse({ ...run, status: 'awaiting_approval' })
      audit('operator.approval_required', 'denied', { toolName: tool.definition.name, approvalReference: `approval:${toolCallId}` })
      persist()
      return success(OperatorResultSchema.parse({
        runId, status: 'approval_required', plan,
        recommendation: `Menunggu approval: ${plan.recommendation}`,
        approval: { required: true, reason: policy.reason },
        tool: { name: tool.definition.name, version: tool.definition.version, permissionDecision: 'approval_required', invocationStatus: 'not_invoked', resultValidationStatus: 'not_applicable', output: null },
        evidence: context.evidence.references, persistence: 'process_local_memory',
      }))
    }

    if (policy.permissionDecision === 'denied') {
      run = OperatorRunSchema.parse({ ...run, status: 'failed', completedAt: this.now(), failureCode: 'PERMISSION_DENIED' })
      audit('operator.failed', 'denied', { errorCode: 'PERMISSION_DENIED', toolName: tool.definition.name })
      persist()
      return success(OperatorResultSchema.parse({
        runId, status: tool.definition.enabled ? 'denied' : 'unavailable', plan, recommendation: plan.recommendation,
        approval: { required: false, reason: policy.reason },
        tool: { name: tool.definition.name, version: tool.definition.version, permissionDecision: 'denied', invocationStatus: 'not_invoked', resultValidationStatus: 'not_applicable', output: null },
        evidence: context.evidence.references, persistence: 'process_local_memory',
      }))
    }

    toolCalls[0] = ToolCallSchema.parse({ ...toolCall, status: 'running' })
    audit('operator.tool_invoked', 'success', { toolName: tool.definition.name, toolVersion: tool.definition.version })
    try {
      const output = await this.options.toolExecutor.invoke(tool, inputResult.data, {
        runId, requestId: execution.requestId, traceId: execution.traceId, operatorContext: context,
      })
      const outputResult = tool.outputSchema.safeParse(output)
      if (!outputResult.success) {
        toolCalls[0] = ToolCallSchema.parse({ ...toolCalls[0], status: 'failed', completedAt: this.now(), errorCode: 'INVALID_TOOL_RESULT' })
        return finishFailure('VALIDATION_FAILED', 'Tool result did not satisfy the registered output schema.')
      }
      toolCalls[0] = ToolCallSchema.parse({
        ...toolCalls[0], status: 'completed', completedAt: this.now(), outputReference: `tool_result:${toolCallId}`,
      })
      audit('operator.tool_result_validated', 'success', { toolName: tool.definition.name })
      run = OperatorRunSchema.parse({ ...run, status: 'completed', completedAt: this.now() })
      audit('operator.completed', 'success', { toolName: tool.definition.name })
      persist()
      this.log('operator.completed', { status: 'completed', data: { runId, opportunityId: goal.opportunityId, toolName: tool.definition.name } })
      return success(OperatorResultSchema.parse({
        runId, status: 'completed', plan, recommendation: plan.recommendation,
        approval: { required: false, reason: null },
        tool: { name: tool.definition.name, version: tool.definition.version, permissionDecision: 'allowed', invocationStatus: 'completed', resultValidationStatus: 'valid', output: outputResult.data },
        evidence: context.evidence.references, persistence: 'process_local_memory',
      }))
    } catch {
      toolCalls[0] = ToolCallSchema.parse({ ...toolCalls[0], status: 'failed', completedAt: this.now(), errorCode: 'TOOL_EXECUTION_FAILED' })
      return finishFailure('VALIDATION_FAILED', 'Tool execution failed safely.')
    }
  }
}
