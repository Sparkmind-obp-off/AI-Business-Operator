import { VoiceIntentSchema, type VoiceIntent } from './contracts'

const approvalWords = /^(yes|yes please|approve|approved|confirm|confirmed|oke|ok|lanjut|setuju|izinkan)$/i
const cancelWords = /\b(cancel|cancelled|batalkan|batal|stop|hentikan)\b/i
const actionWords = /\b(execute|send|publish|run action|lakukan aksi|jalankan aksi|kirim|eksekusi)\b/i
const recommendWords = /\b(recommend|recommendation|next step|rekomendasi|langkah berikut)\b/i
const summarizeWords = /\b(summary|summarize|ringkas|rangkuman)\b/i
const inspectWords = /\b(inspect|review|show|lihat|periksa|opportunity|peluang)\b/i
const clarifyWords = /\b(clarify|jelaskan|maksudnya)\b/i

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function extractDeterministicIntent(
  utterance: string,
  options: { opportunityId?: string; pendingApprovalReference?: string | null } = {},
): VoiceIntent {
  const text = normalize(utterance)
  const base = {
    opportunityId: options.opportunityId ?? null,
    pendingApprovalReference: options.pendingApprovalReference ?? null,
  }

  if (cancelWords.test(text)) {
    return VoiceIntentSchema.parse({ ...base, type: 'cancel', confidence: 1, reason: 'Matched an explicit cancellation phrase.' })
  }
  if (approvalWords.test(text)) {
    return VoiceIntentSchema.parse({
      ...base,
      type: 'approve_action',
      confidence: options.pendingApprovalReference ? 1 : 0.55,
      reason: options.pendingApprovalReference
        ? 'Matched explicit confirmation with an exact pending approval reference.'
        : 'Confirmation phrase has no identifiable pending approval.',
    })
  }
  if (actionWords.test(text)) {
    return VoiceIntentSchema.parse({ ...base, type: 'request_action', confidence: 0.95, reason: 'Matched an explicit action request.' })
  }
  if (recommendWords.test(text)) {
    return VoiceIntentSchema.parse({ ...base, type: 'recommend_action', confidence: 0.9, reason: 'Matched a recommendation request.' })
  }
  if (summarizeWords.test(text)) {
    return VoiceIntentSchema.parse({ ...base, type: 'summarize_opportunity', confidence: 0.9, reason: 'Matched an opportunity summary request.' })
  }
  if (inspectWords.test(text)) {
    return VoiceIntentSchema.parse({ ...base, type: 'inspect_opportunity', confidence: 0.9, reason: 'Matched an opportunity inspection request.' })
  }
  if (clarifyWords.test(text)) {
    return VoiceIntentSchema.parse({ ...base, type: 'clarify', confidence: 0.85, reason: 'Matched an explicit clarification request.' })
  }
  return VoiceIntentSchema.parse({ ...base, type: 'unknown', confidence: 0.2, reason: 'No supported deterministic intent matched.' })
}
