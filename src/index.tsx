import { Hono } from 'hono'
import { getReadiness } from './app/health'
import { createIngestionHandler, normalizeFixtureDemand } from './ingestion'
import { ConfigurationError, loadConfig, type RuntimeEnvironment } from './shared/config'
import { createLogger, type CorrelationContext } from './shared/logger'

type Bindings = RuntimeEnvironment
type Variables = {
  correlation: CorrelationContext
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

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
      <p>Session 2 ingestion foundation is running.</p>
      <nav aria-label="Foundation endpoints">
        <ul>
          <li><a href="/health/live">Liveness</a></li>
          <li><a href="/health/ready">Readiness</a></li>
          <li><a href="/api/v1/fixtures/demand-signal">Deterministic fixture</a></li>
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

app.post('/api/v1/ingestion/events', createIngestionHandler())

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
