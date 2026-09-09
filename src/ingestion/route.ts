import type { Context } from 'hono'
import type { RuntimeEnvironment } from '../shared/config'
import { loadConfig } from '../shared/config'
import { createLogger, type CorrelationContext } from '../shared/logger'
import { IngestionRequestSchema } from './contracts'
import { InMemoryIngestionRepository, type IngestionRepository } from './repository'
import { IngestionService } from './service'

interface IngestionEnvironment {
  Bindings: RuntimeEnvironment
  Variables: { correlation: CorrelationContext }
}

const idempotencyKeyPattern = /^[A-Za-z0-9._:-]{8,128}$/

export const ingestionRepository = new InMemoryIngestionRepository()

export function createIngestionHandler(repository: IngestionRepository = ingestionRepository) {
  return async (c: Context<IngestionEnvironment>) => {
    const correlation = c.get('correlation')
    const config = loadConfig(c.env)
    const logger = createLogger(config.public.environment, correlation)
    const idempotencyKey = c.req.header('idempotency-key')

    logger('info', 'ingestion.received', { status: 'received' })

    if (!idempotencyKey || !idempotencyKeyPattern.test(idempotencyKey)) {
      logger('warn', 'ingestion.validation_failed', {
        status: 'rejected',
        errorCode: 'VALIDATION_FAILED',
        data: { field: 'Idempotency-Key' },
      })
      return c.json(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Idempotency-Key must be 8-128 safe characters.',
            requestId: correlation.requestId,
          },
        },
        400,
      )
    }

    let payload: unknown
    try {
      payload = await c.req.json()
    } catch {
      logger('warn', 'ingestion.validation_failed', {
        status: 'rejected',
        errorCode: 'VALIDATION_FAILED',
        data: { reason: 'invalid_json' },
      })
      return c.json(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Request body must be valid JSON.',
            requestId: correlation.requestId,
          },
        },
        400,
      )
    }

    const parsed = IngestionRequestSchema.safeParse(payload)
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }))
      logger('warn', 'ingestion.validation_failed', {
        status: 'rejected',
        errorCode: 'VALIDATION_FAILED',
        data: { issueCount: issues.length },
      })
      return c.json(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Ingestion request validation failed.',
            details: { issues },
            requestId: correlation.requestId,
          },
        },
        422,
      )
    }

    const service = new IngestionService({
      repository,
      log: (eventName, fields) =>
        logger(fields.errorCode ? 'warn' : 'info', eventName, fields),
    })
    const result = await service.ingest(parsed.data, {
      ...correlation,
      idempotencyKey,
    })

    if (!result.ok) {
      const status = result.error.code === 'IDEMPOTENCY_CONFLICT' ? 409 : 422
      return c.json(
        {
          error: {
            ...result.error,
            requestId: correlation.requestId,
          },
        },
        status,
      )
    }

    return c.json({ data: result.value }, result.value.processingStatus === 'processed' ? 202 : 200)
  }
}
