import { z } from 'zod'
import { CapabilityStatusSchema, SourceTypeSchema } from '../domain'

const idSchema = z.string().min(3).max(128).regex(/^[a-z][a-z0-9_-]+$/)
const timestampSchema = z.iso.datetime({ offset: true })
const metadataSchema = z.record(z.string(), z.unknown()).default({})
const accessMethodSchema = z.enum([
  'fixture',
  'manual',
  'official_api',
  'authorized_integration',
  'search_index',
])

const sensitiveKey = /(authorization|cookie|password|secret|token|api[-_]?key)/i

function findSensitivePath(value: unknown, path: string[] = []): string[] | undefined {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const match = findSensitivePath(value[index], [...path, String(index)])
      if (match) return match
    }
    return undefined
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (sensitiveKey.test(key)) return [...path, key]
      const match = findSensitivePath(child, [...path, key])
      if (match) return match
    }
  }

  return undefined
}

export const IngestionEventInputSchema = z.object({
  externalEventId: z.string().min(1).max(256).optional(),
  payloadReference: z.string().min(1).max(512).optional(),
  sourceUrl: z.url(),
  capturedAt: timestampSchema.optional(),
  publishedAt: timestampSchema.nullable().optional(),
  content: z.object({
    text: z.string().min(1).max(20_000).refine((value) => value.trim().length > 0, {
      message: 'Text must contain non-whitespace content.',
    }),
    language: z.string().trim().min(2).max(20),
  }),
  providerMetadata: metadataSchema,
})

export const IngestionRequestSchema = z
  .object({
    source: z.object({
      id: idSchema,
      provider: z.string().trim().min(1).max(120),
      sourceType: SourceTypeSchema,
      displayName: z.string().trim().min(1).max(160),
      status: CapabilityStatusSchema.default('unknown'),
      capabilities: z.array(z.string().trim().min(1).max(120)).min(1),
      authMode: z.enum(['none', 'api_key', 'oauth2', 'webhook_secret']),
      termsReference: z.url(),
      adapter: z.object({
        name: z.string().trim().min(1).max(120),
        version: z.string().trim().min(1).max(40),
        accessMethod: accessMethodSchema,
      }),
      providerMetadata: metadataSchema,
    }),
    events: z.array(IngestionEventInputSchema).min(1).max(100),
  })
  .superRefine((value, context) => {
    const sensitivePath = findSensitivePath(value)
    if (sensitivePath) {
      context.addIssue({
        code: 'custom',
        path: sensitivePath,
        message: 'Secret-like fields are not accepted in ingestion payloads.',
      })
    }
  })

export type IngestionRequest = z.infer<typeof IngestionRequestSchema>

export interface IngestionResponse {
  requestId: string
  traceId: string
  processingStatus: 'processed' | 'duplicate'
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
  persistence: 'process_local_memory'
}
