import { Hono } from 'hono'
import { z } from 'zod'
import type { RuntimeEnvironment } from '../shared/config'
import { loadConfig } from '../shared/config'
import { createLogger, type CorrelationContext } from '../shared/logger'
import { CreateOpportunityInputSchema, OpportunityStatusSchema } from './contracts'
import type { OpportunityRepository } from './repository'
import { OpportunityService } from './service'

interface OpportunityEnvironment {
  Bindings: RuntimeEnvironment
  Variables: { correlation: CorrelationContext }
}

const TransitionRequestSchema = z.object({
  status: OpportunityStatusSchema,
  reason: z.string().min(1).max(500),
})

export function createOpportunityRouter(repository: OpportunityRepository) {
  const router = new Hono<OpportunityEnvironment>()

  function serviceFor(environment: RuntimeEnvironment, correlation: CorrelationContext) {
    const config = loadConfig(environment)
    const logger = createLogger(config.public.environment, correlation)
    return new OpportunityService({
      repository,
      log: (eventName, fields) => logger(fields.errorCode ? 'warn' : 'info', eventName, fields),
    })
  }

  router.post('/', async (c) => {
    const correlation = c.get('correlation')
    let payload: unknown
    try {
      payload = await c.req.json()
    } catch {
      return c.json({
        error: { code: 'VALIDATION_FAILED', message: 'Request body must be valid JSON.', requestId: correlation.requestId },
      }, 400)
    }

    const parsed = CreateOpportunityInputSchema.safeParse(payload)
    if (!parsed.success) {
      return c.json({
        error: { code: 'VALIDATION_FAILED', message: 'Opportunity request validation failed.', requestId: correlation.requestId },
      }, 422)
    }

    const result = await serviceFor(c.env, correlation).create(parsed.data, correlation)
    if (!result.ok) {
      return c.json({ error: { ...result.error, requestId: correlation.requestId } }, 422)
    }
    return c.json({ data: result.value, persistence: 'process_local_memory' }, 201)
  })

  router.get('/', (c) => {
    const correlation = c.get('correlation')
    const statusInput = c.req.query('status')
    const status = statusInput === undefined ? undefined : OpportunityStatusSchema.safeParse(statusInput)
    if (status && !status.success) {
      return c.json({
        error: { code: 'VALIDATION_FAILED', message: 'Opportunity status filter is invalid.', requestId: correlation.requestId },
      }, 422)
    }

    const records = serviceFor(c.env, correlation).list({
      ...(status?.success ? { status: status.data } : {}),
      ...(c.req.query('segment') ? { segment: c.req.query('segment') } : {}),
    })
    return c.json({ data: records, persistence: 'process_local_memory' })
  })

  router.get('/:id', (c) => {
    const correlation = c.get('correlation')
    const result = serviceFor(c.env, correlation).getById(c.req.param('id'))
    if (!result.ok) {
      return c.json({ error: { ...result.error, requestId: correlation.requestId } }, 404)
    }
    return c.json({ data: result.value, persistence: 'process_local_memory' })
  })

  router.post('/:id/transitions', async (c) => {
    const correlation = c.get('correlation')
    let payload: unknown
    try {
      payload = await c.req.json()
    } catch {
      return c.json({
        error: { code: 'VALIDATION_FAILED', message: 'Request body must be valid JSON.', requestId: correlation.requestId },
      }, 400)
    }

    const parsed = TransitionRequestSchema.safeParse(payload)
    if (!parsed.success) {
      return c.json({
        error: { code: 'VALIDATION_FAILED', message: 'Lifecycle transition validation failed.', requestId: correlation.requestId },
      }, 422)
    }
    const result = serviceFor(c.env, correlation).transition(
      c.req.param('id'),
      parsed.data.status,
      parsed.data.reason,
      correlation,
    )
    if (!result.ok) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 409
      return c.json({ error: { ...result.error, requestId: correlation.requestId } }, status)
    }
    return c.json({ data: result.value, persistence: 'process_local_memory' })
  })

  return router
}
