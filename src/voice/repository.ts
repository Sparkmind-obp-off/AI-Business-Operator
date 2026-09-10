import { VoiceSessionSchema, type VoiceSession, type VoiceSessionStatus } from './contracts'

const allowedTransitions: Record<VoiceSessionStatus, ReadonlySet<VoiceSessionStatus>> = {
  created: new Set(['active', 'cancelled', 'failed']),
  active: new Set(['interrupted', 'cancelled', 'completed', 'failed']),
  interrupted: new Set(['active', 'cancelled', 'completed', 'failed']),
  cancelled: new Set(),
  completed: new Set(),
  failed: new Set(),
}

export interface VoiceSessionRepository {
  save(session: VoiceSession): void
  findById(sessionId: string): VoiceSession | undefined
  transition(sessionId: string, status: VoiceSessionStatus, at: string, failureCode?: string | null): VoiceSession
}

function copy<T>(value: T): T {
  return structuredClone(value)
}

export class InMemoryVoiceSessionRepository implements VoiceSessionRepository {
  private readonly sessions = new Map<string, VoiceSession>()

  save(session: VoiceSession): void {
    this.sessions.set(session.id, copy(VoiceSessionSchema.parse(session)))
  }

  findById(sessionId: string): VoiceSession | undefined {
    const session = this.sessions.get(sessionId)
    return session ? copy(session) : undefined
  }

  transition(sessionId: string, status: VoiceSessionStatus, at: string, failureCode: string | null = null): VoiceSession {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error('VOICE_SESSION_NOT_FOUND')
    if (session.status === status) return copy(session)
    if (!allowedTransitions[session.status].has(status)) {
      throw new Error(`INVALID_VOICE_SESSION_TRANSITION:${session.status}:${status}`)
    }
    const updated = VoiceSessionSchema.parse({
      ...session,
      status,
      updatedAt: at,
      completedAt: ['cancelled', 'completed', 'failed'].includes(status) ? at : null,
      failureCode: status === 'failed' ? (failureCode ?? 'VOICE_SESSION_FAILED') : null,
    })
    this.save(updated)
    return copy(updated)
  }

  clear(): void {
    this.sessions.clear()
  }
}

export function canTransitionVoiceSession(from: VoiceSessionStatus, to: VoiceSessionStatus): boolean {
  return from === to || allowedTransitions[from].has(to)
}
