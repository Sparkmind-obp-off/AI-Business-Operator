import type { Context } from 'hono'
import { ingestionRepository, IngestionService, type IngestionRepository } from '../ingestion'
import { DemandIntelligenceService } from '../intelligence'
import type { RuntimeEnvironment } from '../shared/config'
import { loadConfig } from '../shared/config'
import { createLogger, type CorrelationContext } from '../shared/logger'
import { DeterministicFixtureProviderAdapter, phase7FixtureSource } from './fixture'
import { ProviderAdapterService } from './service'

interface AdapterEnvironment {
  Bindings: RuntimeEnvironment
  Variables: { correlation: CorrelationContext }
}

export function createProviderAdapterFixtureHandler(
  repository: IngestionRepository = ingestionRepository,
) {
  return async (c: Context<AdapterEnvironment>) => {
    const correlation = c.get('correlation')
    const config = loadConfig(c.env)
    const logger = createLogger(config.public.environment, correlation)
    const adapter = new DeterministicFixtureProviderAdapter()
    const adapterLogger = (eventName: string, fields: {
      status: string
      durationMs?: number
      errorCode?: string
      data?: Record<string, unknown>
    }) => logger(fields.errorCode ? 'warn' : 'info', eventName, fields)
    const result = await new ProviderAdapterService({
      adapter,
      ingestionRepository: repository,
      ingestionService: new IngestionService({ repository, log: adapterLogger }),
      intelligenceService: new DemandIntelligenceService({ log: adapterLogger }),
      log: adapterLogger,
    }).sync(phase7FixtureSource, correlation)

    if (!result.ok) {
      const status = result.error.code === 'APPROVAL_REQUIRED'
        ? 403
        : result.error.code === 'RATE_LIMITED'
          ? 429
          : result.error.code === 'INVALID_CONFIGURATION'
            ? 422
            : 503
      return c.json({
        error: {
          code: result.error.code,
          message: result.error.message,
          retryable: result.error.retryable,
          stage: result.stage,
          requestId: correlation.requestId,
        },
      }, status)
    }

    return c.json({
      data: {
        source: result.source,
        capabilities: adapter.getCapabilities(),
        adapterStatus: adapter.getStatus(),
        fetch: {
          status: result.fetch.status,
          eventCount: result.fetch.events.length,
          metadata: result.fetch.metadata,
        },
        ingestion: result.ingestion,
        intelligence: result.intelligence,
        fixture: {
          synthetic: true,
          warning: 'No live provider was accessed.',
        },
      },
    })
  }
}
