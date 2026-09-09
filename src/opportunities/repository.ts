import type { OpportunityRecord, OpportunityStatus } from './contracts'

export interface OpportunityFilter {
  status?: OpportunityStatus
  segment?: string
}

export interface OpportunityRepository {
  findById(id: string): OpportunityRecord | undefined
  findByIdentity(identityKey: string): OpportunityRecord | undefined
  save(record: OpportunityRecord): void
  list(filter?: OpportunityFilter): OpportunityRecord[]
}

function copy(record: OpportunityRecord): OpportunityRecord {
  return structuredClone(record)
}

export class InMemoryOpportunityRepository implements OpportunityRepository {
  private readonly records = new Map<string, OpportunityRecord>()
  private readonly identityIndex = new Map<string, string>()

  findById(id: string): OpportunityRecord | undefined {
    const record = this.records.get(id)
    return record ? copy(record) : undefined
  }

  findByIdentity(identityKey: string): OpportunityRecord | undefined {
    const id = this.identityIndex.get(identityKey)
    return id ? this.findById(id) : undefined
  }

  save(record: OpportunityRecord): void {
    const stored = copy(record)
    this.records.set(stored.opportunity.id, stored)
    this.identityIndex.set(stored.identityKey, stored.opportunity.id)
  }

  list(filter: OpportunityFilter = {}): OpportunityRecord[] {
    return [...this.records.values()]
      .filter((record) => !filter.status || record.opportunity.status === filter.status)
      .filter((record) => !filter.segment || record.opportunity.segment === filter.segment)
      .sort((left, right) => {
        const byCreatedAt = left.opportunity.createdAt.localeCompare(right.opportunity.createdAt)
        return byCreatedAt || left.opportunity.id.localeCompare(right.opportunity.id)
      })
      .map(copy)
  }

  clear(): void {
    this.records.clear()
    this.identityIndex.clear()
  }
}
