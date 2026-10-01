/**
 * Canvas-side mirror of the CSS tokens in styles/tokens.css. The canvas can't read
 * CSS variables cheaply every frame, so the semantic colors live here too.
 */
export const THEME = {
  page: '#0e0f2d',
  text: '#ffffff',
  fog: '#babcd9',
  chrome: '#23272a',
  dm: '#eb459e',
  room: '#00b0f4',
  online: '#57f287',
  ember: '#fda220',
  blurple: '#5865f2',
} as const

/** "r, g, b" triplets for gradients. */
export const RGB = {
  ember: '253, 162, 32',
  room: '0, 176, 244',
  dm: '235, 69, 158',
  blurple: '88, 101, 242',
} as const

export const FONT_MONO = '"Geist Mono", ui-monospace, monospace'
export const FONT_BODY = 'Archivo, "Helvetica Neue", system-ui, sans-serif'
