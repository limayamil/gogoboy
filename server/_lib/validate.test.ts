import { describe, expect, it } from 'vitest'
import { HttpError } from './http.ts'
import {
  dateOrNull,
  httpUrl,
  parseCategoryInput,
  parseTaskCreate,
  parseTaskPatch,
} from './validate.ts'

describe('dateOrNull', () => {
  it('acepta fechas reales', () => {
    expect(dateOrNull('2026-02-28', 'deadline')).toBe('2026-02-28')
    expect(dateOrNull('2024-02-29', 'deadline')).toBe('2024-02-29')
  })

  it('trata null y cadena vacia como "sin deadline"', () => {
    expect(dateOrNull(null, 'deadline')).toBeNull()
    expect(dateOrNull('', 'deadline')).toBeNull()
  })

  it('rechaza fechas que no existen aunque tengan el formato correcto', () => {
    expect(() => dateOrNull('2026-02-31', 'deadline')).toThrow(HttpError)
    expect(() => dateOrNull('2026-13-01', 'deadline')).toThrow(HttpError)
  })

  it('rechaza formatos distintos de YYYY-MM-DD', () => {
    expect(() => dateOrNull('11/09/2026', 'deadline')).toThrow(HttpError)
  })
})

describe('parseTaskCreate', () => {
  it('completa los valores por defecto del boceto', () => {
    expect(parseTaskCreate({ title: '  Comprar regalo ' })).toEqual({
      title: 'Comprar regalo',
      categoryId: null,
      description: null,
      notes: null,
      urgency: 'media',
      deadline: null,
      status: 'pendiente',
      inToday: false,
    })
  })

  it('exige un titulo no vacio', () => {
    expect(() => parseTaskCreate({ title: '   ' })).toThrow(HttpError)
    expect(() => parseTaskCreate({})).toThrow(HttpError)
  })

  it('rechaza urgencias y estados fuera del dominio', () => {
    expect(() => parseTaskCreate({ title: 'x', urgency: 'urgentisima' })).toThrow(HttpError)
    expect(() => parseTaskCreate({ title: 'x', status: 'done' })).toThrow(HttpError)
  })
})

describe('parseTaskPatch', () => {
  it('solo devuelve las claves presentes', () => {
    expect(parseTaskPatch({ status: 'hecha' })).toEqual({ status: 'hecha' })
  })

  it('distingue "no mandaron deadline" de "mandaron deadline en null"', () => {
    expect('deadline' in parseTaskPatch({ status: 'hecha' })).toBe(false)
    expect(parseTaskPatch({ deadline: null })).toEqual({ deadline: null })
  })

  it('permite sacar la categoria mandando null', () => {
    expect(parseTaskPatch({ categoryId: null })).toEqual({ categoryId: null })
  })

  it('rechaza un patch vacio', () => {
    expect(() => parseTaskPatch({})).toThrow(HttpError)
  })

  it('rechaza un categoryId que no es uuid', () => {
    expect(() => parseTaskPatch({ categoryId: 'personal' })).toThrow(HttpError)
  })
})

describe('parseCategoryInput', () => {
  it('normaliza el nombre y exige color', () => {
    expect(parseCategoryInput({ name: ' Casa ', colorKey: 'lila' })).toEqual({
      name: 'Casa',
      colorKey: 'lila',
      position: undefined,
    })
    expect(() => parseCategoryInput({ name: 'Casa' })).toThrow(HttpError)
  })
})

describe('httpUrl', () => {
  it('le pone https:// a una URL sin esquema', () => {
    expect(httpUrl('drive.google.com/file/d/1a2B', 'url')).toBe(
      'https://drive.google.com/file/d/1a2B',
    )
  })

  it('respeta http:// y https:// explicitos', () => {
    expect(httpUrl('http://localhost:3001/x', 'url')).toBe('http://localhost:3001/x')
    expect(httpUrl('https://ejemplo.com', 'url')).toBe('https://ejemplo.com/')
  })

  it('rechaza esquemas que no son http ni https', () => {
    // Un javascript: guardado seria un XSS esperando a que alguien lo toque.
    expect(() => httpUrl('javascript:alert(1)', 'url')).toThrow()
    expect(() => httpUrl('data:text/html,<script>', 'url')).toThrow()
    expect(() => httpUrl('file:///etc/passwd', 'url')).toThrow()
  })

  it('rechaza vacio y texto que no es URL', () => {
    expect(() => httpUrl('   ', 'url')).toThrow()
    expect(() => httpUrl('https://', 'url')).toThrow()
    expect(() => httpUrl(42, 'url')).toThrow()
  })
})
