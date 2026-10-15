import { describe, expect, it } from 'vitest'
import {
  bumpCategoryUsage,
  categoryUsageSetCookie,
  chipsThatFit,
  collapsedCategories,
  COLLAPSED_CATEGORY_LINES,
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

describe('chipsThatFit', () => {
  it('llena hasta dos filas y deja afuera lo que no entra entero', () => {
    expect(COLLAPSED_CATEGORY_LINES).toBe(2)
    // 40 + 10 + 40 = 90 entra; el tercero no. Dos filas → cuatro chips.
    expect(chipsThatFit([40, 40, 40, 40, 40], 100, 10)).toBe(4)
    expect(chipsThatFit([40, 40], 100, 10)).toBe(2)
    expect(chipsThatFit([], 100, 10)).toBe(0)
  })

  it('un chip más ancho que la fila ocupa esa fila y no se descarta', () => {
    expect(chipsThatFit([180, 40, 40, 40], 100, 10)).toBe(3)
  })

  it('sin ancho conocido no esconde chips', () => {
    expect(chipsThatFit([40, 40, 40], 0, 10)).toBe(3)
  })
})

describe('collapsedCategories', () => {
  const today = choices(['', 'dona', 'kinetic', 'jetsons', 'igor', 'pluto'])
  // Dos chips por fila: el colapsado muestra cuatro y el resto queda afuera.
  const widths = today.map(() => 40)
  const fit = (selected: string, usage: Record<string, number> = {}) =>
    collapsedCategories(today, usage, selected, widths, 100, 10)

  it('sin cookie muestra las primeras que entran, en el orden de hoy', () => {
    expect(ids(fit(''))).toEqual(['', 'dona', 'kinetic', 'jetsons'])
  })

  it('si todas entran en dos filas, muestra todas ya rankeadas', () => {
    const few = choices(['', 'dona', 'kinetic'])
    expect(ids(collapsedCategories(few, { kinetic: 2 }, '', [40, 40, 40], 100, 10))).toEqual([
      'kinetic',
      '',
      'dona',
    ])
  })

  it('no mete en la fila un chip que no entra entero', () => {
    expect(chipsThatFit([50, 80], 100, 10, 1)).toBe(1)
    const row = choices(['corta', 'larga'])
    expect(ids(collapsedCategories(row, {}, '', [50, 80], 100, 10, 1))).toEqual(['corta'])
  })

  it('deja la seleccionada si no entra en lo visible y suelta la menos usada', () => {
    const usage = { '': 5, dona: 4, kinetic: 3, jetsons: 2, igor: 1 }
    expect(ids(fit('pluto', usage))).toEqual(['', 'dona', 'kinetic', 'pluto'])
  })

  it('reordena para que la seleccionada no quede antes de una más usada', () => {
    const usage = { '': 10, dona: 8, kinetic: 3, jetsons: 3, pluto: 4 }
    expect(ids(fit('igor', usage))).toEqual(['', 'dona', 'pluto', 'igor'])
  })

  it('no toca el grupo si la seleccionada ya entra', () => {
    const usage = { kinetic: 9, '': 1 }
    expect(ids(fit('kinetic', usage))).toEqual(['kinetic', '', 'dona', 'jetsons'])
  })

  it('ignora una seleccionada que no existe', () => {
    expect(ids(fit('fantasma', { igor: 6 }))).toEqual(['igor', '', 'dona', 'kinetic'])
  })

  it('un nombre más ancho que la fila igual se muestra entero', () => {
    const row = choices(['enorme', 'a', 'b'])
    expect(ids(collapsedCategories(row, {}, '', [240, 40, 40], 100, 10))).toEqual([
      'enorme',
      'a',
      'b',
    ])
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
