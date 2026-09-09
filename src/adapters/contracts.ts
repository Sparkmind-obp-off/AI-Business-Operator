import { z } from 'zod'
import {
  CapabilityStatusSchema,
  SourceSchema,
  SourceTypeSchema,
  type CapabilityStatus,
  type Source,
} from '../domain'
import { IngestionEventInputSchema, type IngestionEventInput } from '../ingestion'

const timestampSchema = z.iso.datetime({ offset: true })
const metadataSchema = z.record(z.string(), z.unknown()).default({})

export const AdapterAccessMethodSchema = z.enum([
  'fixture',
  'manual',
  'official_api',
  'authorized_integration',
  'search_index',
])

export const ProviderOperationSchema = z.enum(['discover', 'read_events'])
export const ProviderAuthModeSchema = z.enum(['none', 'api_key', 'oauth2', 'webhook_secret'])

export const ProviderCapabilitySchema = z.object({
  provider: z.string().min(1).max(120),
  sourceType: SourceTypeSchema,
  operation: ProviderOperationSchema,
  status: CapabilityStatusSchema,
  authMode: ProviderAuthModeSchema,
  approvalRequired: z.boolean(),
  accessMethod: AdapterAccessMethodSchema,
  pagination: z.object({
    supported: z.boolean(),
    cursorBased: z.boolean(),
    maxPageSize: z.number().int().positive().nullable(),
  }),
  rateLimit: z.object({
    known: z.boolean(),
    requests: z.number().int().positive().nullable(),
    windowSeconds: z.number().int().positive().nullable(),
  }),
  identityStability: z.enum(['stable', 'variable', 'unknown']),
  freshnessExpectation: z.enum(['realtime', 'near_realtime', 'scheduled', 'fixture', 'unknown']),
  termsReference: z.url(),
  documentationReference: z.url(),
  limitations: z.array(z.string().min(1).max(500)),
  verifiedAt: timestampSchema.nullable(),
}).superRefine((value, context) => {
  if (value.status === 'approval_required' && !value.approvalRequired) {
    context.addIssue({
      code: 'custom',
      path: ['approvalRequired'],
      message: 'approval_required capabilities must declare approvalRequired=true.',
    })
  }
  if (value.status === 'available' && value.approvalRequired) {
    context.addIssue({
      code: 'custom',
      path: ['status'],
      message: 'An approval-gated capability cannot be marked available.',
    })
  }
})

export const AdapterStatusSchema = z.object({
  adapterName: z.string().min(1).max(120),
  adapterVersion: z.string().min(1).max(40),
  provider: z.string().min(1).max(120),
  capabilityStatus: CapabilityStatusSchema,
  authenticationStatus: z.enum(['not_required', 'configured', 'missing', 'invalid', 'unknown']),
  availability: z.enum(['available', 'degraded', 'unavailable', 'unknown']),
  lastSuccessfulSync: timestampSchema.nullable(),
  lastFailure: z.object({
    occurredAt: timestampSchema,
    code: z.string().min(1).max(120),
    retryable: z.boolean(),
  }).nullable(),
  rateLimit: z.object({
    limited: z.boolean(),
    retryAfterSeconds: z.number().int().nonnegative().nullable(),
  }),
})

export const AdapterFetchRequestSchema = z.object({
  source: SourceSchema,
  cursor: z.string().min(1).max(512).nullable().default(null),
  limit: z.number().int().min(1).max(100).default(25),
})

const fetchMetadataSchema = z.object({
  provider: z.string().min(1).max(120),
  adapterName: z.string().min(1).max(120),
  adapterVersion: z.string().min(1).max(40),
  accessMethod: AdapterAccessMethodSchema,
  capabilityStatus: CapabilityStatusSchema,
  fetchedAt: timestampSchema,
  retryable: z.boolean(),
  pagination: z.object({
    supported: z.boolean(),
    nextCursor: z.string().min(1).max(512).nullable(),
  }),
  rateLimit: z.object({
    limited: z.boolean(),
    retryAfterSeconds: z.number().int().nonnegative().nullable(),
  }),
  partial: z.boolean(),
  metadata: metadataSchema,
})

export const AdapterFetchSuccessSchema = z.object({
  ok: z.literal(true),
  status: z.enum(['succeeded', 'partial']),
  events: z.array(IngestionEventInputSchema).max(100),
  metadata: fetchMetadataSchema,
})

export const AdapterFailureCodeSchema = z.enum([
  'APPROVAL_REQUIRED',
  'PROVIDER_UNAVAILABLE',
  'RATE_LIMITED',
  'INVALID_CONFIGURATION',
  'PROVIDER_ERROR',
])

export const AdapterFetchFailureSchema = z.object({
  ok: z.literal(false),
  status: z.enum([
    'approval_required',
    'unavailable',
    'rate_limited',
    'invalid_configuration',
    'provider_error',
  ]),
  error: z.object({
    code: AdapterFailureCodeSchema,
    message: z.string().min(1).max(500),
    retryable: z.boolean(),
  }),
  metadata: fetchMetadataSchema,
})

export const AdapterFetchResultSchema = z.discriminatedUnion('ok', [
  AdapterFetchSuccessSchema,
  AdapterFetchFailureSchema,
])

export type ProviderCapability = z.infer<typeof ProviderCapabilitySchema>
export type AdapterStatus = z.infer<typeof AdapterStatusSchema>
export type AdapterFetchRequest = z.infer<typeof AdapterFetchRequestSchema>
export type AdapterFetchResult = z.infer<typeof AdapterFetchResultSchema>

export interface AdapterConfigurationValidation {
  valid: boolean
  source?: Source
  error?: {
    code: 'INVALID_CONFIGURATION'
    message: string
  }
}

export interface ProviderAdapter {
  getCapabilities(): readonly ProviderCapability[]
  getStatus(): AdapterStatus
  validateConfiguration(source: unknown): AdapterConfigurationValidation
  fetch(request: AdapterFetchRequest): Promise<AdapterFetchResult>
}

export interface AdapterEventBatch {
  source: Source
  events: IngestionEventInput[]
}

export type AdapterCapabilityStatus = CapabilityStatus
