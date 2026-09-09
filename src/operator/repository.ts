import type { AuditEvent, ToolCall } from '../domain'
import type { OperatorRunRecord } from './contracts'

export interface OperatorRepository {
  save(record: OperatorRunRecord): void
  findById(id: string): OperatorRunRecord | undefined
  listToolCalls(runId: string): ToolCall[]
  listAuditEvents(runId: string): AuditEvent[]
}

function copy<T>(value: T): T {
  return structuredClone(value)
}

export class InMemoryOperatorRepository implements OperatorRepository {
  private readonly records = new Map<string, OperatorRunRecord>()

  save(record: OperatorRunRecord): void {
    this.records.set(record.run.id, copy(record))
  }

  findById(id: string): OperatorRunRecord | undefined {
    const record = this.records.get(id)
    return record ? copy(record) : undefined
  }

  listToolCalls(runId: string): ToolCall[] {
    return this.findById(runId)?.toolCalls ?? []
  }

  listAuditEvents(runId: string): AuditEvent[] {
    return this.findById(runId)?.auditEvents ?? []
  }

  clear(): void {
    this.records.clear()
  }
}
