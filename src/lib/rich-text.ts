/**
 * HTML de Tiptap vs texto legado. Las columnas siguen siendo `text`;
 * estos helpers son la unica frontera donde se interpreta el markup.
 */

import { RICH_TEXT_MAX } from '../shared/types'

export { RICH_TEXT_MAX }

const TAG_RE = /<[^>]+>/g
const BLOCK_CLOSE_RE = /<\/(p|div|h[1-6]|li|blockquote|tr|pre)>/gi
const BREAK_RE = /<br\s*[^>]*>/gi
const SCRIPT_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
}

/** Texto visible para busqueda y previews. El legado sin tags se devuelve igual. */
export function richTextPlain(html: string | null): string {
  if (!html) return ''
  const stripped = html
    .replace(SCRIPT_RE, ' ')
    .replace(BREAK_RE, ' ')
    .replace(BLOCK_CLOSE_RE, ' ')
    .replace(TAG_RE, '')
  return decodeEntities(stripped).replace(/\s+/g, ' ').trim()
}

export function isEmptyRichText(html: string): boolean {
  return richTextPlain(html).length === 0
}

/** Lo que se manda al API: null si el editor no tiene texto visible. */
export function serializeRichText(html: string): string | null {
  const trimmed = html.trim()
  if (!trimmed || isEmptyRichText(trimmed)) return null
  return trimmed
}

export function richTextExcerpt(html: string | null, max = 160): string {
  const compact = richTextPlain(html)
  return compact.length > max ? `${compact.slice(0, max).trimEnd()}…` : compact
}
