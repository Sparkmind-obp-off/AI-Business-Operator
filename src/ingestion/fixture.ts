import {
  CONTRACT_VERSION,
  DemandObjectSchema,
  RawEventSchema,
  SourceSchema,
  type DemandObject,
  type RawEvent,
  type Source,
} from '../domain'
import { failure, success, type Result } from '../shared/result'

const FIXTURE_TIMESTAMP = '2026-01-15T10:30:00.000Z'
const FIXTURE_SOURCE_URL = 'https://fixture.example.test/demand/request-001'

export const demandSignalSourceFixture: Source = SourceSchema.parse({
  contractVersion: CONTRACT_VERSION,
  id: 'source_fixture_manual',
  provider: 'session1.fixture',
  sourceType: 'manual',
  displayName: 'Session 1 deterministic test source',
  status: 'available',
  capabilities: ['read_fixture'],
  authMode: 'none',
  capabilityMetadata: {
    synthetic: true,
    warning: 'Test data only. No external platform was accessed.',
  },
  termsReference: 'https://fixture.example.test/terms',
  createdAt: FIXTURE_TIMESTAMP,
  updatedAt: FIXTURE_TIMESTAMP,
})

export const demandSignalRawEventFixture: RawEvent = RawEventSchema.parse({
  contractVersion: CONTRACT_VERSION,
  id: 'event_fixture_request_001',
  sourceId: demandSignalSourceFixture.id,
  externalEventId: 'fixture-request-001',
  payloadReference: 'fixture://session-1/demand-request-001',
  payloadHash: `sha256:${'a'.repeat(64)}`,
  sourceUrl: FIXTURE_SOURCE_URL,
  capturedAt: FIXTURE_TIMESTAMP,
  publishedAt: '2026-01-14T09:00:00.000Z',
  ingestionVersion: 'fixture-v1',
  receivedAt: FIXTURE_TIMESTAMP,
  processingStatus: 'validated',
  errorCode: null,
  content: {
    text: 'Test fixture: a small travel agency requests a simple website and booking enquiry workflow.',
    language: 'en',
    metadata: {
      synthetic: true,
      audience: 'small travel agency',
      topic: 'travel website',
    },
  },
  provenance: {
    sourceId: demandSignalSourceFixture.id,
    sourceUrl: FIXTURE_SOURCE_URL,
    adapterName: 'fixture.manual',
    adapterVersion: '1.0.0',
    accessMethod: 'fixture',
    capturedAt: FIXTURE_TIMESTAMP,
    transformations: [],
  },
})

export function normalizeFixtureDemand(
  sourceInput: unknown = demandSignalSourceFixture,
  eventInput: unknown = demandSignalRawEventFixture,
): Result<DemandObject> {
  const sourceResult = SourceSchema.safeParse(sourceInput)
  const eventResult = RawEventSchema.safeParse(eventInput)

  if (!sourceResult.success || !eventResult.success) {
    return failure('VALIDATION_FAILED', 'Fixture input did not satisfy canonical contracts.')
  }

  const source = sourceResult.data
  const event = eventResult.data

  if (event.sourceId !== source.id || event.provenance.sourceId !== source.id) {
    return failure('VALIDATION_FAILED', 'Raw event provenance does not match the source.')
  }

  const demandResult = DemandObjectSchema.safeParse({
    contractVersion: CONTRACT_VERSION,
    id: 'demand_fixture_travel_website_001',
    sourceId: source.id,
    rawEventId: event.id,
    sourceUrl: event.sourceUrl,
    capturedAt: event.capturedAt,
    publishedAt: event.publishedAt,
    authorReference: null,
    text: event.content.text,
    summary: 'A synthetic small travel agency requests a website with a booking enquiry workflow.',
    topic: 'travel website development',
    market: 'small travel agencies',
    location: null,
    intentType: 'explicit_request',
    evidenceStrength: 0.85,
    commercialIntent: 0.75,
    urgency: 0.5,
    recurrence: 'single',
    estimatedBudgetSignal: null,
    contactability: 'not_permitted',
    confidence: 0.82,
    observedFacts: [
      'The fixture text explicitly requests a website.',
      'The fixture text explicitly mentions a booking enquiry workflow.',
    ],
    inferences: [
      {
        statement: 'The request may represent a service opportunity for a web developer.',
        confidence: 0.72,
      },
    ],
    classificationVersion: 'fixture-rules-v1',
    provenance: {
      ...event.provenance,
      rawEventId: event.id,
      transformations: ['fixture-rules-v1: explicit request normalization'],
    },
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
  })

  if (!demandResult.success) {
    return failure('VALIDATION_FAILED', 'Normalized fixture did not satisfy DemandObject contract.')
  }

  return success(demandResult.data)
}
