export type AppErrorCode =
  | 'CONFIG_INVALID'
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'

export interface AppError {
  code: AppErrorCode
  message: string
  details?: Readonly<Record<string, unknown>>
}

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: AppError }

export const success = <T>(value: T): Result<T> => ({ ok: true, value })

export const failure = (
  code: AppErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): Result<never> => ({
  ok: false,
  error: { code, message, ...(details ? { details } : {}) },
})
