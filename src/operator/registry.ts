import { z } from 'zod'
import {
  ApprovalFixtureInputSchema,
  ApprovalFixtureOutputSchema,
  InspectOpportunityInputSchema,
  InspectOpportunityOutputSchema,
  ToolDefinitionSchema,
  type ToolDefinition,
} from './contracts'

export interface RegisteredTool<TInput = unknown, TOutput = unknown> {
  definition: ToolDefinition
  inputSchema: z.ZodType<TInput>
  outputSchema: z.ZodType<TOutput>
}

export interface ToolRegistry {
  resolve(name: string): RegisteredTool | undefined
}

export class ExplicitToolRegistry implements ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>()

  constructor(tools: RegisteredTool[]) {
    for (const tool of tools) {
      const definition = ToolDefinitionSchema.parse(tool.definition)
      if (this.tools.has(definition.name)) throw new Error(`Duplicate tool registration: ${definition.name}`)
      this.tools.set(definition.name, { ...tool, definition })
    }
  }

  resolve(name: string): RegisteredTool | undefined {
    return this.tools.get(name)
  }
}

export function createSession6ToolRegistry(): ExplicitToolRegistry {
  return new ExplicitToolRegistry([
    {
      definition: {
        name: 'opportunity.inspect',
        version: '1.0.0',
        description: 'Read a validated canonical Opportunity, Score, and compact evidence references.',
        requiredPermissions: ['opportunity.read'],
        riskLevel: 'low',
        approvalPolicy: 'none',
        timeoutMs: 1_000,
        maxRetries: 0,
        auditRequired: true,
        providerDependencies: [],
        enabled: true,
      },
      inputSchema: InspectOpportunityInputSchema,
      outputSchema: InspectOpportunityOutputSchema,
    },
    {
      definition: {
        name: 'external.action.fixture',
        version: '1.0.0',
        description: 'Non-executing fixture used only to prove the approval boundary.',
        requiredPermissions: ['action.execute'],
        riskLevel: 'high',
        approvalPolicy: 'always',
        timeoutMs: 1_000,
        maxRetries: 0,
        auditRequired: true,
        providerDependencies: ['fixture-only'],
        enabled: true,
      },
      inputSchema: ApprovalFixtureInputSchema,
      outputSchema: ApprovalFixtureOutputSchema,
    },
    {
      definition: {
        name: 'disabled.fixture',
        version: '1.0.0',
        description: 'Disabled fixture proving unavailable tools cannot run.',
        requiredPermissions: ['opportunity.read'],
        riskLevel: 'low',
        approvalPolicy: 'disabled',
        timeoutMs: 1_000,
        maxRetries: 0,
        auditRequired: true,
        providerDependencies: [],
        enabled: false,
      },
      inputSchema: InspectOpportunityInputSchema,
      outputSchema: InspectOpportunityOutputSchema,
    },
  ])
}

export interface PolicyDecision {
  permissionDecision: 'allowed' | 'denied' | 'approval_required'
  reason: string | null
}

export function evaluateToolPolicy(
  tool: RegisteredTool,
  grantedPermissions: ReadonlySet<string>,
): PolicyDecision {
  if (!tool.definition.enabled || tool.definition.approvalPolicy === 'disabled') {
    return { permissionDecision: 'denied', reason: 'Tool is disabled or unavailable.' }
  }
  const missing = tool.definition.requiredPermissions.filter((permission) => !grantedPermissions.has(permission))
  if (missing.length > 0) {
    return { permissionDecision: 'denied', reason: `Missing permission: ${missing.join(', ')}.` }
  }
  if (tool.definition.approvalPolicy === 'always'
    || (tool.definition.approvalPolicy === 'conditional' && tool.definition.riskLevel !== 'low')) {
    return { permissionDecision: 'approval_required', reason: 'External side effect requires user approval.' }
  }
  return { permissionDecision: 'allowed', reason: null }
}
