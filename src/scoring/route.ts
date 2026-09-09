import { Hono } from 'hono'
import type { OpportunityRepository } from '../opportunities'
import type { RuntimeEnvironment } from '../shared/config'
import { loadConfig } from '../shared/config'
import { createLogger, type CorrelationContext } from '../shared/logger'
import { ScoreApiRequestSchema } from './contracts'
import type { ScoreRepository } from './repository'
import { OpportunityScoringService } from './service'

interface ScoringEnvironment {
  Bindings: RuntimeEnvironment
  Variables: { correlation: CorrelationContext }
}

export function createScoringRouter(
  opportunityRepository: OpportunityRepository,
  scoreRepository: ScoreRepository,
) {
  const router = new Hono<ScoringEnvironment>()

  function serviceFor(environment: RuntimeEnvironment, correlation: CorrelationContext) {
    const config = loadConfig(environment)
    const logger = createLogger(config.public.environment, correlation)
    return new OpportunityScoringService({
      opportunityRepository,
      scoreRepository,
      log: (eventName, fields) => logger(fields.errorCode ? 'warn' : 'info', eventName, fields),
    })
  }

  router.post('/:id/score', async (c) => {
    const correlation = c.get('correlation')
    let payload: unknown
    try {
      payload = await c.req.json()
    } catch {
      return c.json({
        error: { code: 'VALIDATION_FAILED', message: 'Request body must be valid JSON.', requestId: correlation.requestId },
      }, 400)
    }

    const parsed = ScoreApiRequestSchema.safeParse(payload)
    if (!parsed.success) {
      return c.json({
        error: { code: 'VALIDATION_FAILED', message: 'Score request validation failed.', requestId: correlation.requestId },
      }, 422)
    }

    const opportunity = opportunityRepository.findById(c.req.param('id'))
    if (!opportunity) {
      return c.json({
        error: { code: 'NOT_FOUND', message: 'Opportunity was not found.', requestId: correlation.requestId },
      }, 404)
    }

    const result = await serviceFor(c.env, correlation).score({
      opportunityRecord: opportunity,
      demand: parsed.data.demand,
      intelligence: parsed.data.intelligence,
    }, correlation)
    if (!result.ok) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 422
      return c.json({ error: { ...result.error, requestId: correlation.requestId } }, status)
    }
    return c.json({
      data: result.value,
      persistence: 'process_local_memory',
      disclaimer: 'Prioritization signal only; not a guarantee of purchase, conversion, or revenue.',
    }, 201)
  })

  router.get('/:id/score', (c) => {
    const correlation = c.get('correlation')
    const service = serviceFor(c.env, correlation)
    const latest = service.getLatest(c.req.param('id'))
    if (!latest.ok) {
      return c.json({ error: { ...latest.error, requestId: correlation.requestId } }, 404)
    }
    const history = service.getHistory(c.req.param('id'))
    return c.json({
      data: { latest: latest.value, history: history.ok ? history.value : [] },
      persistence: 'process_local_memory',
      disclaimer: 'Prioritization signal only; not a guarantee of purchase, conversion, or revenue.',
    })
  })

  return router
}
