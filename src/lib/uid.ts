import { MAX_NAME_LENGTH } from './packet'

export type NameResult = { ok: true; name: string } | { ok: false; error: string }

export function validateName(raw: string): NameResult {
  const name = raw.trim()
  if (name.length === 0) return { ok: false, error: 'Pick a name first.' }
  if (name.length > MAX_NAME_LENGTH) return { ok: false, error: `Keep it under ${MAX_NAME_LENGTH + 1} characters.` }
  return { ok: true, name }
}

const SLUG_MAX = 12
const SUFFIX_SPACE = 36 ** 4

/** CometChat UIDs allow only alphanumerics, underscore and hyphen. */
export function makeUid(name: string, random: () => number = Math.random): string {
  const slug =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, SLUG_MAX)
      .replace(/-+$/, '') || 'player'
  const suffix = Math.floor(random() * SUFFIX_SPACE)
    .toString(36)
    .padStart(4, '0')
  return `pt-${slug}-${suffix}`
}
