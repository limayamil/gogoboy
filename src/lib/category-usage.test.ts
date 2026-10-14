import { describe, expect, it } from 'vitest'
import {
  bumpCategoryUsage,
  categoryUsageSetCookie,
  collapsedCategories,
  COLLAPSED_CATEGORY_LIMIT,
  parseCategoryUsage,
  rankCategoriesByUsage,
  UNCATEGORIZED_USAGE_KEY,
  usageFromCookieHeader,
  usageKeyForCategory,
} from './category-usage'

const ids = (choices: { id: string }[]) => choices.map((choice) => choice.id)

const choices = (keys: string[]) => keys.map((id) => ({ id }))

describe('usageKeyForCategory', () => {
  it('usa la clave vacía para Sin categoría', () => {
    expect(usageKeyForCategory(null)).toBe(UNCATEGORIZED_USAGE_KEY)
    expect(usageKeyForCategory('casa')).toBe('casa')
  })
})

describe('rankCategoriesByUsage', () => {
  const today = choices(['', 'dona', 'kinetic', 'jetsons', 'igor'])

  it('sin conteos deja el orden de hoy', () => {
    expect(ids(rankCategoriesByUsage(today, {}))).toEqual(['', 'dona', 'kinetic', 'jetsons', 'igor'])
  })

  it('pone más a la izquierda la que más se eligió', () => {
    expect(ids(rankCategoriesByUsage(today, { kinetic: 4, dona: 2, '': 1 }))).toEqual([
      'kinetic',
      'dona',
      '',
      'jetsons',
      'igor',
    ])
  })

  it('en empate conserva el orden de hoy', () => {
    expect(ids(rankCategoriesByUsage(today, { igor: 3, dona: 3, kinetic: 1 }))).toEqual([
      'dona',
      'igor',
      'kinetic',
      '',
      'jetsons',
    ])
  })

  it('ignora conteos que no son enteros positivos', () => {
    expect(ids(rankCategoriesByUsage(today, { dona: 0, kinetic: -2, jetsons: 1.5, igor: 2 }))).toEqual([
      'igor',
      '',
      'dona',
      'kinetic',
      'jetsons',
    ])
  })

  it('no muta la lista de entrada', () => {
    const input = choices(['a', 'b'])
    rankCategoriesByUsage(input, { b: 3 })
    expect(ids(input)).toEqual(['a', 'b'])
  })
})

describe('collapsedCategories', () => {
  const today = choices(['', 'dona', 'kinetic', 'jetsons', 'igor', 'pluto'])

  it('sin cookie muestra las primeras cuatro del orden de hoy', () => {
    expect(ids(collapsedCategories(today, {}, ''))).toEqual(['', 'dona', 'kinetic', 'jetsons'])
    expect(COLLAPSED_CATEGORY_LIMIT).toBe(4)
  })

  it('si hay cuatro o menos, muestra todas ya rankeadas', () => {
    const few = choices(['', 'dona', 'kinetic'])
    expect(ids(collapsedCategories(few, { kinetic: 2 }, ''))).toEqual(['kinetic', '', 'dona'])
  })

  it('deja la seleccionada en la fila si no entra en el top y suelta la menos usada', () => {
    const usage = { '': 5, dona: 4, kinetic: 3, jetsons: 2, igor: 1 }
    expect(ids(collapsedCategories(today, usage, 'pluto'))).toEqual(['', 'dona', 'kinetic', 'pluto'])
  })

  it('reordena la fila para que la seleccionada no quede antes de una más usada', () => {
    const usage = { '': 10, dona: 8, kinetic: 3, jetsons: 3, pluto: 4 }
    expect(ids(collapsedCategories(today, usage, 'igor'))).toEqual(['', 'dona', 'pluto', 'igor'])
  })

  it('no toca el top si la seleccionada ya está', () => {
    const usage = { kinetic: 9, '': 1 }
    expect(ids(collapsedCategories(today, usage, 'kinetic'))).toEqual(['kinetic', '', 'dona', 'jetsons'])
  })

  it('ignora una seleccionada que no existe', () => {
    expect(ids(collapsedCategories(today, { igor: 6 }, 'fantasma'))).toEqual([
      'igor',
      '',
      'dona',
      'kinetic',
    ])
  })

  it('respeta un límite chico con el mismo criterio de empate', () => {
    const row = choices(['a', 'b', 'c', 'd'])
    expect(ids(collapsedCategories(row, {}, 'd', 2))).toEqual(['a', 'd'])
    expect(ids(collapsedCategories(row, { c: 2, d: 2, b: 1 }, 'a', 2))).toEqual(['c', 'a'])
  })
})

describe('parseCategoryUsage', () => {
  it('lee un mapa de id a conteo', () => {
    expect(parseCategoryUsage('{"casa":3,"":1}')).toEqual({ casa: 3, '': 1 })
  })

  it('descarta basura y valores que no son conteos', () => {
    expect(parseCategoryUsage('{"a":0,"b":-3,"c":2,"d":"x","e":1.9,"f":true}')).toEqual({ c: 2 })
    expect(parseCategoryUsage('nope')).toEqual({})
    expect(parseCategoryUsage('null')).toEqual({})
    expect(parseCategoryUsage('[]')).toEqual({})
    expect(parseCategoryUsage('')).toEqual({})
    expect(parseCategoryUsage(undefined)).toEqual({})
  })
})

describe('bumpCategoryUsage', () => {
  it('suma uno solo a la categoría elegida', () => {
    const prev = { casa: 2 }
    expect(bumpCategoryUsage(prev, 'laburo')).toEqual({ casa: 2, laburo: 1 })
    expect(bumpCategoryUsage(prev, '')).toEqual({ casa: 2, '': 1 })
    expect(prev).toEqual({ casa: 2 })
  })

  it('trata un conteo inválido como cero antes de sumar', () => {
    expect(bumpCategoryUsage({ casa: -4 }, 'casa')).toEqual({ casa: 1 })
  })
})

describe('cookie', () => {
  it('escribe Path=/ y SameSite=Lax y se lee entre otras cookies', () => {
    const setCookie = categoryUsageSetCookie({ '': 2, kinetic: 4 })
    expect(setCookie.startsWith('gogoboy.categoryUsage=')).toBe(true)
    expect(setCookie).toContain('Path=/')
    expect(setCookie).toContain('SameSite=Lax')
    expect(usageFromCookieHeader(`tema=claro; ${setCookie}; otra=1`)).toEqual({
      '': 2,
      kinetic: 4,
    })
  })

  it('no confunde un nombre parecido y cae a vacío si el valor no es JSON', () => {
    expect(usageFromCookieHeader('gogoboy.categoryUsageExtra={"a":9}')).toEqual({})
    expect(usageFromCookieHeader('gogoboy.categoryUsage=no-es-json')).toEqual({})
    expect(usageFromCookieHeader('')).toEqual({})
  })
})
