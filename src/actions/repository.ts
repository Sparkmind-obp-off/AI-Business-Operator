import type { AuditEvent } from '../domain'
import type { ActionExecutionRecord } from './contracts'

export interface ActionExecutionRepository {
  save(record: ActionExecutionRecord): void
  appendAudit(actionId: string, event: AuditEvent): void
  findByActionId(actionId: string): ActionExecutionRecord | undefined
  findByIdempotencyKey(idempotencyKey: string): ActionExecutionRecord | undefined
  listAuditEvents(actionId: string): AuditEvent[]
}

function copy<T>(value: T): T {
  return structuredClone(value)
}

export class InMemoryActionExecutionRepository implements ActionExecutionRepository {
  private readonly byActionId = new Map<string, ActionExecutionRecord>()
  private readonly byIdempotencyKey = new Map<string, ActionExecutionRecord>()
  private readonly auditByActionId = new Map<string, AuditEvent[]>()

  save(record: ActionExecutionRecord): void {
    const stored = copy(record)
    this.byActionId.set(record.action.id, stored)
    this.byIdempotencyKey.set(record.idempotencyKey, stored)
  }

  appendAudit(actionId: string, event: AuditEvent): void {
    const events = this.auditByActionId.get(actionId) ?? []
    events.push(copy(event))
    this.auditByActionId.set(actionId, events)
  }

  findByActionId(actionId: string): ActionExecutionRecord | undefined {
    const record = this.byActionId.get(actionId)
    return record ? copy(record) : undefined
  }

  findByIdempotencyKey(idempotencyKey: string): ActionExecutionRecord | undefined {
    const record = this.byIdempotencyKey.get(idempotencyKey)
    return record ? copy(record) : undefined
  }

  listAuditEvents(actionId: string): AuditEvent[] {
    return copy(this.auditByActionId.get(actionId) ?? [])
  }

  clear(): void {
    this.byActionId.clear()
    this.byIdempotencyKey.clear()
    this.auditByActionId.clear()
  }
}
