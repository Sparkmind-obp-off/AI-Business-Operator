import type { DemandEvidence, DemandObject, RawEvent, Source } from '../domain'

export interface IngestionArtifact {
  dedupeKey: string
  source: Source
  rawEvent: RawEvent
  demand: DemandObject
  evidence: DemandEvidence
}

export interface StoredIngestionOutcome {
  acceptedEventIds: string[]
  duplicateEventIds: string[]
  demandIds: string[]
  evidenceIds: string[]
  references: Array<{
    eventId: string
    demandId: string
    sourceId: string
    sourceUrl: string
    payloadReference: string
  }>
}

export interface IdempotencyRecord {
  requestFingerprint: string
  outcome: StoredIngestionOutcome
}

export interface IngestionRepository {
  findIdempotency(key: string): IdempotencyRecord | undefined
  saveIdempotency(key: string, record: IdempotencyRecord): void
  findArtifact(dedupeKey: string): IngestionArtifact | undefined
  findArtifactByEventId(eventId: string): IngestionArtifact | undefined
  saveArtifact(artifact: IngestionArtifact): void
}

export class InMemoryIngestionRepository implements IngestionRepository {
  private readonly idempotency = new Map<string, IdempotencyRecord>()
  private readonly artifacts = new Map<string, IngestionArtifact>()

  findIdempotency(key: string): IdempotencyRecord | undefined {
    return this.idempotency.get(key)
  }

  saveIdempotency(key: string, record: IdempotencyRecord): void {
    this.idempotency.set(key, record)
  }

  findArtifact(dedupeKey: string): IngestionArtifact | undefined {
    return this.artifacts.get(dedupeKey)
  }

  findArtifactByEventId(eventId: string): IngestionArtifact | undefined {
    return [...this.artifacts.values()].find((artifact) => artifact.rawEvent.id === eventId)
  }

  saveArtifact(artifact: IngestionArtifact): void {
    this.artifacts.set(artifact.dedupeKey, artifact)
  }

  clear(): void {
    this.idempotency.clear()
    this.artifacts.clear()
  }
}
