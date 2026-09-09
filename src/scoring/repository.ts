import type { ScoreRecord } from './contracts'

export interface ScoreRepository {
  findById(id: string): ScoreRecord | undefined
  findByFingerprint(inputFingerprint: string): ScoreRecord | undefined
  findLatestByOpportunityId(opportunityId: string): ScoreRecord | undefined
  listByOpportunityId(opportunityId: string): ScoreRecord[]
  save(record: ScoreRecord): void
}

function copy(record: ScoreRecord): ScoreRecord {
  return structuredClone(record)
}

export class InMemoryScoreRepository implements ScoreRepository {
  private readonly records = new Map<string, ScoreRecord>()
  private readonly fingerprintIndex = new Map<string, string>()
  private readonly latestOpportunityIndex = new Map<string, string>()

  findById(id: string): ScoreRecord | undefined {
    const record = this.records.get(id)
    return record ? copy(record) : undefined
  }

  findByFingerprint(inputFingerprint: string): ScoreRecord | undefined {
    const id = this.fingerprintIndex.get(inputFingerprint)
    return id ? this.findById(id) : undefined
  }

  findLatestByOpportunityId(opportunityId: string): ScoreRecord | undefined {
    const id = this.latestOpportunityIndex.get(opportunityId)
    return id ? this.findById(id) : undefined
  }

  listByOpportunityId(opportunityId: string): ScoreRecord[] {
    return [...this.records.values()]
      .filter((record) => record.score.opportunityId === opportunityId)
      .sort((left, right) => {
        const byCreatedAt = left.score.createdAt.localeCompare(right.score.createdAt)
        return byCreatedAt || left.score.id.localeCompare(right.score.id)
      })
      .map(copy)
  }

  save(record: ScoreRecord): void {
    const stored = copy(record)
    this.records.set(stored.score.id, stored)
    this.fingerprintIndex.set(stored.inputFingerprint, stored.score.id)
    this.latestOpportunityIndex.set(stored.score.opportunityId, stored.score.id)
  }

  clear(): void {
    this.records.clear()
    this.fingerprintIndex.clear()
    this.latestOpportunityIndex.clear()
  }
}
