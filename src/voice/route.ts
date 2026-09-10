import type { Context } from 'hono'
import type { ActionExecutionRepository, ActionExecutionService } from '../actions'
import { normalizeFixtureDemand } from '../ingestion'
import { DemandIntelligenceService } from '../intelligence'
import type { OpportunityRepository } from '../opportunities'
import { OpportunityService } from '../opportunities'
import {
  createSession6ToolRegistry,
  InMemoryOperatorRepository,
  OperatorService,
  Session6FixtureToolExecutor,
} from '../operator'
import type { ScoreRepository } from '../scoring'
import { OpportunityScoringService } from '../scoring'
import { loadConfig, type RuntimeEnvironment } from '../shared/config'
import { createLogger, type CorrelationContext } from '../shared/logger'
import { DeterministicSyntheticVoiceProvider } from './providers'
import { InMemoryVoiceSessionRepository } from './repository'
import { VoiceService } from './service'

type VoiceFixtureContext = Context<{
  Bindings: RuntimeEnvironment
  Variables: { correlation: CorrelationContext }
}>

const FIXTURE_TIME = '2026-09-10T09:00:00.000Z'

export function createVoiceFixtureHandler(
  opportunityRepository: OpportunityRepository,
  scoreRepository: ScoreRepository,
  createActionBoundary: () => {
    repository: ActionExecutionRepository
    service: ActionExecutionService
  },
) {
  return async (c: VoiceFixtureContext) => {
    const correlation = c.get('correlation')
    const logger = createLogger(loadConfig(c.env).public.environment, correlation)
    const log = (eventName: string, fields: { status: string; errorCode?: string; data?: Record<string, unknown> }) =>
      logger(fields.errorCode ? 'warn' : 'info', eventName, fields)
    const demand = normalizeFixtureDemand()
    if (!demand.ok) return c.json({ error: demand.error }, 500)
    const intelligence = new DemandIntelligenceService({ now: () => FIXTURE_TIME }).analyze(demand.value, correlation)
    if (!intelligence.ok) return c.json({ error: intelligence.error }, 500)
    const opportunityService = new OpportunityService({ repository: opportunityRepository, now: () => FIXTURE_TIME })
    const opportunity = await opportunityService.create({ demand: demand.value, intelligence: intelligence.value }, correlation)
    if (!opportunity.ok) return c.json({ error: opportunity.error }, 500)
    const enriched = opportunity.value.opportunity.status === 'new'
      ? opportunityService.transition(opportunity.value.opportunity.id, 'enriched', 'Voice fixture evidence review.', correlation)
      : opportunity
    if (!enriched.ok) return c.json({ error: enriched.error }, 500)
    const score = await new OpportunityScoringService({
      opportunityRepository,
      scoreRepository,
      now: () => FIXTURE_TIME,
    }).score({ opportunityRecord: enriched.value, demand: demand.value, intelligence: intelligence.value }, correlation)
    if (!score.ok) return c.json({ error: score.error }, 500)

    const operatorRepository = new InMemoryOperatorRepository()
    const voiceRepository = new InMemoryVoiceSessionRepository()
    const { repository: actionRepository, service: actionService } = createActionBoundary()
    const provider = new DeterministicSyntheticVoiceProvider(() => FIXTURE_TIME)
    const voice = new VoiceService({
      repository: voiceRepository,
      inputProvider: provider,
      responseProvider: provider,
      operatorService: new OperatorService({
        opportunityRepository,
        scoreRepository,
        operatorRepository,
        toolRegistry: createSession6ToolRegistry(),
        toolExecutor: new Session6FixtureToolExecutor(),
        now: () => FIXTURE_TIME,
      }),
      actionService,
      now: () => FIXTURE_TIME,
      log,
    })
    const execution = {
      ...correlation,
      permissions: new Set(['opportunity.read', 'action.execute']),
      actorReference: 'fixture_voice_user',
    }
    const session = await voice.createSession(correlation)
    const requested = await voice.processTurn({
      sessionId: session.id,
      utterance: 'Jalankan aksi fixture untuk peluang ini.',
      opportunityId: opportunity.value.opportunity.id,
    }, execution)
    const approved = await voice.processTurn({
      sessionId: session.id,
      utterance: 'setuju',
      opportunityId: opportunity.value.opportunity.id,
    }, execution)
    const completed = voice.complete(session.id)
    const actionId = approved.response.actionId

    return c.json({
      data: {
        session: completed,
        turns: [requested.turn, approved.turn],
        responses: [requested.response, approved.response],
        progressEvents: [...requested.events, ...approved.events],
        operatorRun: requested.response.operatorRunId
          ? operatorRepository.findById(requested.response.operatorRunId)
          : null,
        actionAuditEvents: actionId ? actionRepository.listAuditEvents(actionId) : [],
      },
      fixture: {
        provider: provider.name,
        synthetic: true,
        deterministic: true,
        liveAudio: false,
        liveSttTts: false,
        liveLlm: false,
        sideEffectPerformed: false,
        warning: 'Synthetic voice-text fixture only; no live audio, provider, or external side effect was used.',
      },
    })
  }
}
