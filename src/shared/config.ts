import { z } from 'zod'

const booleanStringSchema = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true')

const runtimeEnvironmentSchema = z.object({
  APP_ENV: z.enum(['local', 'dev', 'staging', 'prod']).default('local'),
  APP_BASE_URL: z.url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  EXTERNAL_SIDE_EFFECTS_ENABLED: booleanStringSchema,
  PROVIDER_API_KEY: z.string().min(1).optional(),
  MAKE_WEBHOOK_SECRET: z.string().min(1).optional(),
})

export type RuntimeEnvironment = z.input<typeof runtimeEnvironmentSchema>

export interface AppConfig {
  public: {
    environment: 'local' | 'dev' | 'staging' | 'prod'
    baseUrl: string
    logLevel: 'debug' | 'info' | 'warn' | 'error'
    externalSideEffectsEnabled: boolean
  }
  server: {
    providerApiKey?: string
    makeWebhookSecret?: string
  }
}

export class ConfigurationError extends Error {
  readonly code = 'CONFIG_INVALID'

  constructor(readonly issues: readonly string[]) {
    super(`Invalid application configuration: ${issues.join('; ')}`)
    this.name = 'ConfigurationError'
  }
}

export function loadConfig(environment: RuntimeEnvironment = {}): AppConfig {
  const parsed = runtimeEnvironmentSchema.safeParse(environment)

  if (!parsed.success) {
    throw new ConfigurationError(
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    )
  }

  const values = parsed.data

  return {
    public: {
      environment: values.APP_ENV,
      baseUrl: values.APP_BASE_URL,
      logLevel: values.LOG_LEVEL,
      externalSideEffectsEnabled: values.EXTERNAL_SIDE_EFFECTS_ENABLED,
    },
    server: {
      ...(values.PROVIDER_API_KEY ? { providerApiKey: values.PROVIDER_API_KEY } : {}),
      ...(values.MAKE_WEBHOOK_SECRET
        ? { makeWebhookSecret: values.MAKE_WEBHOOK_SECRET }
        : {}),
    },
  }
}
