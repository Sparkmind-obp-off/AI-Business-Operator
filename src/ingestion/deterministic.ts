const textEncoder = new TextEncoder()

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    )
  }
  return value
}

export function stableSerialize(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

export async function sha256(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(stableSerialize(value)))
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `sha256:${hex}`
}

export function idFromHash(prefix: string, hash: string): string {
  return `${prefix}_${hash.slice('sha256:'.length, 'sha256:'.length + 32)}`
}

export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}
