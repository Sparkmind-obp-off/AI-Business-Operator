import { describe, expect, it } from 'vitest'
import { ConfigurationError, loadConfig } from '../src/shared/config'
import { createLogger } from '../src/shared/logger'

describe('configuration and logging security', () => {
  it('loads safe defaults without provider secrets', () => {
    const config = loadConfig({})
    expect(config.public.environment).toBe('local')
    expect(config.public.externalSideEffectsEnabled).toBe(false)
    expect(config.server).toEqual({})
  })

  it('fails safely for invalid configuration', () => {
    expect(() => loadConfig({ APP_ENV: 'production' as never })).toThrow(ConfigurationError)
    expect(() => loadConfig({ APP_BASE_URL: 'not-a-url' })).toThrow(ConfigurationError)
  })

  it('keeps server secrets out of public configuration', () => {
    const config = loadConfig({ PROVIDER_API_KEY: 'secret-provider-value' })
    expect(JSON.stringify(config.public)).not.toContain('secret-provider-value')
    expect(config.server.providerApiKey).toBe('secret-provider-value')
  })

  it('redacts secret-like keys and bearer credentials from structured logs', () => {
    const output: string[] = []
    const logger = createLogger(
      'local',
      { requestId: 'request_test', traceId: 'trace_test' },
      (record) => output.push(record),
    )

    logger('info', 'security.redaction_test', {
      data: {
        password: 'do-not-log',
        nested: { apiKey: 'also-do-not-log' },
        message: 'Authorization: Bearer abcdefghijklmnop',
      },
    })

    expect(output).toHaveLength(1)
    expect(output[0]).not.toContain('do-not-log')
    expect(output[0]).not.toContain('also-do-not-log')
    expect(output[0]).not.toContain('abcdefghijklmnop')
    expect(output[0]).toContain('[REDACTED]')
  })
})
