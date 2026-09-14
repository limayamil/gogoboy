import { describe, expect, it } from 'vitest'
import { HttpError } from './http.ts'
import {
  dateOrNull,
  httpUrl,
  parseCategoryInput,
  parseNoteCreate,
  parseNotePatch,
  parseTagNames,
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

describe('parseTagNames', () => {
  it('recorta, ignora vacios duplicados y conserva la primera capitalizacion', () => {
    expect(parseTagNames([' Casa ', 'casa', 'Trabajo'])).toEqual(['Casa', 'Trabajo'])
  })

  it('trata null como ninguna etiqueta', () => {
    expect(parseTagNames(null)).toEqual([])
  })

  it('rechaza algo que no sea lista', () => {
    expect(() => parseTagNames('casa')).toThrow(HttpError)
  })

  it('rechaza una etiqueta demasiado larga', () => {
    expect(() => parseTagNames(['x'.repeat(41)])).toThrow(HttpError)
  })
})

describe('parseNoteCreate', () => {
  it('exige titulo y deja descripcion y etiquetas opcionales', () => {
    expect(parseNoteCreate({ title: '  Idea ' })).toEqual({
      title: 'Idea',
      kind: 'note',
      description: null,
      username: null,
      password: null,
      tags: [],
    })
  })

  it('acepta descripcion y etiquetas', () => {
    expect(
      parseNoteCreate({ title: 'Idea', description: '  detalle  ', tags: ['inbox'] }),
    ).toEqual({
      title: 'Idea',
      kind: 'note',
      description: 'detalle',
      username: null,
      password: null,
      tags: ['inbox'],
    })
  })

  it('una contraseña exige clave, usuario opcional y no guarda etiquetas', () => {
    expect(
      parseNoteCreate({
        title: ' Gmail ',
        kind: 'password',
        username: '  yo@correo.com ',
        password: '  secreto ',
        tags: ['inbox'],
        description: 'no va',
      }),
    ).toEqual({
      title: 'Gmail',
      kind: 'password',
      description: null,
      username: 'yo@correo.com',
      password: 'secreto',
      tags: [],
    })
  })

  it('exige clave si el tipo es contraseña', () => {
    expect(() => parseNoteCreate({ title: 'Gmail', kind: 'password' })).toThrow(HttpError)
  })

  it('rechaza un tipo desconocido', () => {
    expect(() => parseNoteCreate({ title: 'x', kind: 'pin' })).toThrow(HttpError)
  })

  it('exige un titulo no vacio', () => {
    expect(() => parseNoteCreate({ title: '   ' })).toThrow(HttpError)
    expect(() => parseNoteCreate({})).toThrow(HttpError)
  })

  it('acepta una description HTML larga y rechaza si se pasa del tope', () => {
    const html = `<p>${'a'.repeat(6000)}</p>`
    expect(parseNoteCreate({ title: 'Larga', description: html }).description).toBe(html)
    expect(() =>
      parseNoteCreate({ title: 'Larga', description: 'x'.repeat(20_001) }),
    ).toThrow(HttpError)
  })
})

describe('parseNotePatch', () => {
  it('solo devuelve las claves presentes', () => {
    expect(parseNotePatch({ title: 'Nuevo' })).toEqual({ title: 'Nuevo' })
  })

  it('distingue "no mandaron description" de "mandaron description en null"', () => {
    expect('description' in parseNotePatch({ title: 'x' })).toBe(false)
    expect(parseNotePatch({ description: null })).toEqual({ description: null })
  })

  it('reemplaza etiquetas cuando vienen en el payload', () => {
    expect(parseNotePatch({ tags: ['a', 'b'] })).toEqual({ tags: ['a', 'b'] })
  })

  it('copia usuario y clave solo si vienen en el payload', () => {
    expect(parseNotePatch({ username: '  ana ' })).toEqual({ username: 'ana' })
    expect(parseNotePatch({ username: '   ' })).toEqual({ username: null })
    expect(parseNotePatch({ password: '  nueva ' })).toEqual({ password: 'nueva' })
    expect('password' in parseNotePatch({ title: 'x' })).toBe(false)
  })

  it('no deja vaciar la clave ni cambiar el tipo', () => {
    expect(() => parseNotePatch({ password: '   ' })).toThrow(HttpError)
    expect(() => parseNotePatch({ kind: 'password' })).toThrow(HttpError)
  })

  it('rechaza un patch vacio', () => {
    expect(() => parseNotePatch({})).toThrow(HttpError)
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
