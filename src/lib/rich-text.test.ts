import { describe, expect, it } from 'vitest'
import {
  RICH_TEXT_MAX,
  isEmptyRichText,
  richTextExcerpt,
  richTextPlain,
  serializeRichText,
} from './rich-text'

describe('richTextPlain', () => {
  it('deja el texto legado sin tags tal cual', () => {
    expect(richTextPlain('Para el living')).toBe('Para el living')
  })

  it('saca los tags y junta bloques con espacio', () => {
    expect(richTextPlain('<p>hola <strong>mundo</strong></p><p>otra</p>')).toBe('hola mundo otra')
  })

  it('decodifica entidades comunes', () => {
    expect(richTextPlain('<p>A &amp; B &lt; C</p>')).toBe('A & B < C')
  })

  it('null y vacio dan cadena vacia', () => {
    expect(richTextPlain(null)).toBe('')
    expect(richTextPlain('')).toBe('')
  })
})

describe('isEmptyRichText', () => {
  it('trata el HTML vacio de Tiptap como vacio', () => {
    expect(isEmptyRichText('')).toBe(true)
    expect(isEmptyRichText('<p></p>')).toBe(true)
    expect(isEmptyRichText('<p><br></p>')).toBe(true)
    expect(isEmptyRichText('<p><br class="ProseMirror-trailingBreak"></p>')).toBe(true)
  })

  it('no vacia un parrafo con texto', () => {
    expect(isEmptyRichText('<p>hola</p>')).toBe(false)
  })
})

describe('serializeRichText', () => {
  it('guarda null si no hay texto visible', () => {
    expect(serializeRichText('<p></p>')).toBeNull()
    expect(serializeRichText('   ')).toBeNull()
  })

  it('conserva el HTML con contenido', () => {
    expect(serializeRichText('<p>hola</p>')).toBe('<p>hola</p>')
  })
})

describe('richTextExcerpt', () => {
  it('recorta el texto plano, no el HTML', () => {
    const html = `<p>${'palabra '.repeat(40)}</p>`
    const excerpt = richTextExcerpt(html, 40)
    expect(excerpt.endsWith('…')).toBe(true)
    expect(excerpt).not.toContain('<p>')
    expect(excerpt.length).toBeLessThanOrEqual(41)
  })
})

describe('RICH_TEXT_MAX', () => {
  it('deja margen para el HTML, mas que el texto plano de antes', () => {
    expect(RICH_TEXT_MAX).toBeGreaterThan(5000)
  })
})
