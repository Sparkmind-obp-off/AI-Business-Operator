export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface CorrelationContext {
  requestId: string
  traceId: string
  runId?: string
}

export interface LogRecord extends CorrelationContext {
  timestamp: string
  level: LogLevel
  service: 'ai-business-operator'
  environment: string
  eventName: string
  status?: string
  durationMs?: number
  errorCode?: string
  data?: unknown
}

type LogSink = (record: string) => void

const sensitiveKey = /(authorization|cookie|password|secret|token|api[-_]?key)/i
const sensitiveValuePatterns = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\bsk-[A-Za-z0-9_-]{8,}\b/g,
]

function redactString(value: string): string {
  return sensitiveValuePatterns.reduce(
    (redacted, pattern) => redacted.replace(pattern, '[REDACTED]'),
    value,
  )
}

export function redact(value: unknown): unknown {
  if (typeof value === 'string') return redactString(value)
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        sensitiveKey.test(key) ? '[REDACTED]' : redact(child),
      ]),
    )
  }
  return value
}

export function createLogger(
  environment: string,
  context: CorrelationContext,
  sink: LogSink = console.log,
) {
  return (
    level: LogLevel,
    eventName: string,
    fields: Partial<Omit<LogRecord, keyof CorrelationContext | 'level' | 'eventName'>> = {},
  ): void => {
    const record: LogRecord = {
      timestamp: new Date().toISOString(),
      level,
      service: 'ai-business-operator',
      environment,
      eventName,
      ...context,
      ...fields,
      ...(fields.data === undefined ? {} : { data: redact(fields.data) }),
    }
    sink(JSON.stringify(redact(record)))
  }
}
