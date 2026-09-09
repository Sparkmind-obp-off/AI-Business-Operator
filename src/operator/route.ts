import { Hono } from 'hono'
import type { OpportunityRepository } from '../opportunities'
import type { ScoreRepository } from '../scoring'
import { loadConfig, type RuntimeEnvironment } from '../shared/config'
import { createLogger, type CorrelationContext } from '../shared/logger'
import { Session6FixtureToolExecutor } from './executor'
import { createSession6ToolRegistry } from './registry'
import type { OperatorRepository } from './repository'
import { OperatorService } from './service'

interface OperatorEnvironment {
  Bindings: RuntimeEnvironment
  Variables: { correlation: CorrelationContext }
}

export function createOperatorRouter(
  opportunityRepository: OpportunityRepository,
  scoreRepository: ScoreRepository,
  operatorRepository: OperatorRepository,
) {
  const router = new Hono<OperatorEnvironment>()

  router.post('/runs', async (c) => {
    const correlation = c.get('correlation')
    let payload: unknown
    try {
      payload = await c.req.json()
    } catch {
      return c.json({
        error: { code: 'VALIDATION_FAILED', message: 'Request body must be valid JSON.', requestId: correlation.requestId },
      }, 400)
    }

    const config = loadConfig(c.env)
    const logger = createLogger(config.public.environment, correlation)
    const service = new OperatorService({
      opportunityRepository,
      scoreRepository,
      operatorRepository,
      toolRegistry: createSession6ToolRegistry(),
      toolExecutor: new Session6FixtureToolExecutor(),
      log: (eventName, fields) => logger(fields.errorCode ? 'warn' : 'info', eventName, fields),
    })
    const result = await service.run(payload, {
      ...correlation,
      permissions: new Set(['opportunity.read']),
    })
    if (!result.ok) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 422
      return c.json({ error: { ...result.error, requestId: correlation.requestId } }, status)
    }
    const status = result.value.status === 'approval_required' ? 202 : 200
    return c.json({ data: result.value }, status)
  })

  router.get('/runs/:id', (c) => {
    const correlation = c.get('correlation')
    const record = operatorRepository.findById(c.req.param('id'))
    if (!record) {
      return c.json({
        error: { code: 'NOT_FOUND', message: 'Operator run was not found.', requestId: correlation.requestId },
      }, 404)
    }
    return c.json({ data: record, persistence: 'process_local_memory' })
  })

  return router
}
