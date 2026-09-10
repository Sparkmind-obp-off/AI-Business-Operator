import { VoiceInputSchema, VoiceResponseSchema, type VoiceInput, type VoiceResponse } from './contracts'

export interface VoiceInputProvider {
  readonly name: string
  normalize(input: unknown): VoiceInput
}

export interface VoiceResponseProvider {
  readonly name: string
  render(response: VoiceResponse): VoiceResponse
}

export class DeterministicSyntheticVoiceProvider implements VoiceInputProvider, VoiceResponseProvider {
  readonly name = 'phase9.synthetic-voice-fixture'

  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  normalize(input: unknown): VoiceInput {
    const value = typeof input === 'string' ? input : ''
    return VoiceInputSchema.parse({
      provider: this.name,
      synthetic: true,
      utterance: value,
      receivedAt: this.now(),
    })
  }

  render(response: VoiceResponse): VoiceResponse {
    return VoiceResponseSchema.parse({ ...response, synthetic: true })
  }
}
