import { describe, expect, it } from 'vitest'
import app from '../src/index'

describe('application foundation', () => {
  it('reports liveness with correlation headers', async () => {
    const response = await app.request('/health/live', {
      headers: { 'x-request-id': 'request_test', 'x-trace-id': 'trace_test' },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'alive' })
    expect(response.headers.get('x-request-id')).toBe('request_test')
    expect(response.headers.get('x-trace-id')).toBe('trace_test')
  })

  it('reports readiness without asserting provider health', async () => {
    const response = await app.request('/health/ready')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: 'ready',
      dependencies: [],
      providers: { status: 'not_checked' },
    })
  })

  it('serves the deterministic demand fixture through the versioned API', async () => {
    const response = await app.request('/api/v1/fixtures/demand-signal')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'demand_fixture_travel_website_001',
        provenance: { accessMethod: 'fixture' },
      },
    })
  })
})
