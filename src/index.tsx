import { Hono } from 'hono'
import { getReadiness } from './app/health'
import { createIngestionHandler, normalizeFixtureDemand } from './ingestion'
import { createIntelligenceHandler, DemandIntelligenceService } from './intelligence'
import {
  createOpportunityRouter,
  InMemoryOpportunityRepository,
  OpportunityService,
} from './opportunities'
import {
  createScoringRouter,
  InMemoryScoreRepository,
  OpportunityScoringService,
} from './scoring'
import { ConfigurationError, loadConfig, type RuntimeEnvironment } from './shared/config'
import { createLogger, type CorrelationContext } from './shared/logger'

type Bindings = RuntimeEnvironment
type Variables = {
  correlation: CorrelationContext
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()
const opportunityRepository = new InMemoryOpportunityRepository()
const scoreRepository = new InMemoryScoreRepository()

app.use('*', async (c, next) => {
  const requestId = c.req.header('x-request-id') ?? crypto.randomUUID()
  const traceId = c.req.header('x-trace-id') ?? requestId
  const correlation = { requestId, traceId }
  c.set('correlation', correlation)

  const startedAt = Date.now()
  await next()

  c.header('x-request-id', requestId)
  c.header('x-trace-id', traceId)

  const config = loadConfig(c.env)
  createLogger(config.public.environment, correlation)('info', 'http.request_completed', {
    status: String(c.res.status),
    durationMs: Date.now() - startedAt,
  })
})

app.get('/', (c) =>
  c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>AI Business Operator</title>
  </head>
  <body>
    <main>
      <h1>AI Business Operator</h1>
      <p>Session 5 deterministic Opportunity Scoring is running.</p>
      <nav aria-label="Foundation endpoints">
        <ul>
          <li><a href="/health/live">Liveness</a></li>
          <li><a href="/health/ready">Readiness</a></li>
          <li><a href="/api/v1/fixtures/demand-signal">Deterministic demand fixture</a></li>
          <li><a href="/api/v1/fixtures/demand-intelligence">Deterministic intelligence fixture</a></li>
          <li><a href="/api/v1/fixtures/opportunity">Deterministic opportunity fixture</a></li>
          <li><a href="/api/v1/fixtures/opportunity-score">Deterministic opportunity score fixture</a></li>
        </ul>
      </nav>
    </main>
  </body>
</html>`),
)

app.get('/health/live', (c) => c.json({ status: 'alive' }))

app.get('/health/ready', (c) => {
  const config = loadConfig(c.env)
  return c.json(getReadiness(config))
})

app.get('/api/v1/fixtures/demand-signal', (c) => {
  const result = normalizeFixtureDemand()
  if (!result.ok) return c.json({ error: result.error }, 500)
  return c.json({ data: result.value })
})

app.get('/api/v1/fixtures/demand-intelligence', (c) => {
  const demand = normalizeFixtureDemand()
  if (!demand.ok) return c.json({ error: demand.error }, 500)

  const config = loadConfig(c.env)
  const correlation = c.get('correlation')
  const logger = createLogger(config.public.environment, correlation)
  const service = new DemandIntelligenceService({
    now: () => '2026-01-15T10:30:00.000Z',
    log: (eventName, fields) => logger(fields.errorCode ? 'warn' : 'info', eventName, fields),
  })
  const result = service.analyze(demand.value, correlation)
  if (!result.ok) return c.json({ error: result.error }, 500)
  return c.json({ data: result.value })
})

app.get('/api/v1/fixtures/opportunity', async (c) => {
  const demand = normalizeFixtureDemand()
  if (!demand.ok) return c.json({ error: demand.error }, 500)

  const config = loadConfig(c.env)
  const correlation = c.get('correlation')
  const logger = createLogger(config.public.environment, correlation)
  const intelligence = new DemandIntelligenceService({
    now: () => '2026-01-15T10:30:00.000Z',
    log: (eventName, fields) => logger(fields.errorCode ? 'warn' : 'info', eventName, fields),
  }).analyze(demand.value, correlation)
  if (!intelligence.ok) return c.json({ error: intelligence.error }, 500)

  const result = await new OpportunityService({
    repository: opportunityRepository,
    now: () => '2026-01-15T10:30:00.000Z',
    log: (eventName, fields) => logger(fields.errorCode ? 'warn' : 'info', eventName, fields),
  }).create({ demand: demand.value, intelligence: intelligence.value }, correlation)
  if (!result.ok) return c.json({ error: result.error }, 500)
  return c.json({ data: result.value, persistence: 'process_local_memory' })
})

app.get('/api/v1/fixtures/opportunity-score', async (c) => {
  const demand = normalizeFixtureDemand()
  if (!demand.ok) return c.json({ error: demand.error }, 500)

  const config = loadConfig(c.env)
  const correlation = c.get('correlation')
  const logger = createLogger(config.public.environment, correlation)
  const intelligence = new DemandIntelligenceService({
    now: () => '2026-01-15T10:30:00.000Z',
    log: (eventName, fields) => logger(fields.errorCode ? 'warn' : 'info', eventName, fields),
  }).analyze(demand.value, correlation)
  if (!intelligence.ok) return c.json({ error: intelligence.error }, 500)

  const opportunityService = new OpportunityService({
    repository: opportunityRepository,
    now: () => '2026-01-15T10:30:00.000Z',
    log: (eventName, fields) => logger(fields.errorCode ? 'warn' : 'info', eventName, fields),
  })
  const opportunity = await opportunityService.create({ demand: demand.value, intelligence: intelligence.value }, correlation)
  if (!opportunity.ok) return c.json({ error: opportunity.error }, 500)
  const enriched = opportunity.value.opportunity.status === 'new'
    ? opportunityService.transition(opportunity.value.opportunity.id, 'enriched', 'Fixture evidence reviewed before scoring.', correlation)
    : opportunity
  if (!enriched.ok) return c.json({ error: enriched.error }, 500)

  const score = await new OpportunityScoringService({
    opportunityRepository,
    scoreRepository,
    now: () => '2026-01-15T10:30:00.000Z',
    log: (eventName, fields) => logger(fields.errorCode ? 'warn' : 'info', eventName, fields),
  }).score({ opportunityRecord: enriched.value, demand: demand.value, intelligence: intelligence.value }, correlation)
  if (!score.ok) return c.json({ error: score.error }, 500)
  return c.json({
    data: score.value,
    persistence: 'process_local_memory',
    disclaimer: 'Prioritization signal only; not a guarantee of purchase, conversion, or revenue.',
  })
})

app.post('/api/v1/ingestion/events', createIngestionHandler())
app.post('/api/v1/intelligence/classify', createIntelligenceHandler())
app.route('/api/v1/opportunities', createScoringRouter(opportunityRepository, scoreRepository))
app.route('/api/v1/opportunities', createOpportunityRouter(opportunityRepository))

app.notFound((c) =>
  c.json(
    {
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found.',
      },
    },
    404,
  ),
)

app.onError((error, c) => {
  const correlation = c.get('correlation') ?? {
    requestId: crypto.randomUUID(),
    traceId: crypto.randomUUID(),
  }
  const environment = c.env?.APP_ENV ?? 'local'
  const errorCode = error instanceof ConfigurationError ? error.code : 'INTERNAL_ERROR'
  createLogger(environment, correlation)('error', 'http.request_failed', {
    status: '500',
    errorCode,
  })
  return c.json(
    {
      error: {
        code: errorCode,
        message: error instanceof ConfigurationError ? error.message : 'Internal server error.',
        requestId: correlation.requestId,
      },
    },
    500,
  )
})

export default app
