import type { Context } from 'hono'
import { z } from 'zod'
import { DemandObjectSchema } from '../domain'
import type { RuntimeEnvironment } from '../shared/config'
import { loadConfig } from '../shared/config'
import { createLogger, type CorrelationContext } from '../shared/logger'
import { DemandIntelligenceService } from './service'

interface IntelligenceEnvironment {
  Bindings: RuntimeEnvironment
  Variables: { correlation: CorrelationContext }
}

const IntelligenceRequestSchema = z.object({ demand: DemandObjectSchema })

export function createIntelligenceHandler() {
  return async (c: Context<IntelligenceEnvironment>) => {
    const correlation = c.get('correlation')
    const config = loadConfig(c.env)
    const logger = createLogger(config.public.environment, correlation)

    let payload: unknown
    try {
      payload = await c.req.json()
    } catch {
      logger('warn', 'intelligence.validation_failed', {
        status: 'rejected',
        errorCode: 'VALIDATION_FAILED',
        data: { reason: 'invalid_json' },
      })
      return c.json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request body must be valid JSON.',
          requestId: correlation.requestId,
        },
      }, 400)
    }

    const parsed = IntelligenceRequestSchema.safeParse(payload)
    if (!parsed.success) {
      logger('warn', 'intelligence.validation_failed', {
        status: 'rejected',
        errorCode: 'VALIDATION_FAILED',
        data: { issueCount: parsed.error.issues.length },
      })
      return c.json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Demand intelligence request validation failed.',
          requestId: correlation.requestId,
        },
      }, 422)
    }

    const service = new DemandIntelligenceService({
      log: (eventName, fields) => logger(fields.errorCode ? 'warn' : 'info', eventName, fields),
    })
    const result = service.analyze(parsed.data.demand, correlation)
    if (!result.ok) {
      return c.json({ error: { ...result.error, requestId: correlation.requestId } }, 422)
    }

    return c.json({ data: result.value })
  }
}
