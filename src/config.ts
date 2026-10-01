/**
 * CometChat credentials come from `.env.local` (see `.env.example`).
 * `npx @cometchat/skills-cli@3 provision run` writes these for you.
 *
 * NOTE: the Auth Key is for development/demo only. For production, mint
 * Auth Tokens server-side and use loginWithAuthToken() instead.
 */
export const COMETCHAT = {
  APP_ID: (import.meta.env.VITE_COMETCHAT_APP_ID ?? '').trim(),
  REGION: (import.meta.env.VITE_COMETCHAT_REGION ?? '').trim(),
  AUTH_KEY: (import.meta.env.VITE_COMETCHAT_AUTH_KEY ?? '').trim(),
} as const

export const isCometChatConfigured = (): boolean =>
  COMETCHAT.APP_ID !== '' && COMETCHAT.REGION !== '' && COMETCHAT.AUTH_KEY !== ''

/** `?local=1` forces the offline BroadcastChannel transport (handy for UI work). */
export const forceLocalMode = (): boolean => new URLSearchParams(window.location.search).get('local') === '1'
