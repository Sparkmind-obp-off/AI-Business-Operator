import type { AppConfig } from '../shared/config'

export interface ReadinessStatus {
  status: 'ready'
  environment: AppConfig['public']['environment']
  dependencies: readonly []
  providers: {
    status: 'not_checked'
    message: string
  }
}

export function getReadiness(config: AppConfig): ReadinessStatus {
  return {
    status: 'ready',
    environment: config.public.environment,
    dependencies: [],
    providers: {
      status: 'not_checked',
      message: 'No external provider is configured or asserted healthy in Session 1.',
    },
  }
}
