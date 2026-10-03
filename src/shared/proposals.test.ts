import { describe, expect, it } from 'vitest'
import { resolveAcceptCategory, type CategoryPick } from './proposals'

const casa: CategoryPick = { id: 'casa', name: 'Casa', position: 2 }
const casaBaja: CategoryPick = { id: 'casa-baja', name: 'casa', position: 0 }
const viaje: CategoryPick = { id: 'viaje', name: 'Viaje', position: 1 }

describe('resolveAcceptCategory', () => {
  it('crea si el nombre no coincide con ninguna', () => {
    expect(resolveAcceptCategory({ categoryName: 'Tramites' }, [casa])).toEqual({
      kind: 'create',
      name: 'Tramites',
    })
  })

  it('no crea si el nombre viene vacio o null', () => {
    expect(resolveAcceptCategory({ categoryName: '   ' }, [casa])).toEqual({ kind: 'none' })
    expect(resolveAcceptCategory({ categoryName: null, categoryId: null }, [casa])).toEqual({
      kind: 'none',
    })
    expect(resolveAcceptCategory({}, [casa])).toEqual({ kind: 'none' })
  })

  it('usa el id si la categoria sigue existiendo, aunque el nombre diga otra cosa', () => {
    expect(
      resolveAcceptCategory({ categoryId: 'casa', categoryName: 'Tramites' }, [casa, viaje]),
    ).toEqual({ kind: 'existing', categoryId: 'casa' })
  })

  it('si el id ya no esta, engancha por nombre sin distinguir mayusculas y se queda con la de menor position', () => {
    expect(
      resolveAcceptCategory({ categoryId: 'borrada', categoryName: 'CASA' }, [casa, casaBaja, viaje]),
    ).toEqual({ kind: 'existing', categoryId: 'casa-baja' })
  })

  it('si el id ya no esta y el nombre tampoco, crea', () => {
    expect(resolveAcceptCategory({ categoryId: 'borrada', categoryName: 'Nueva' }, [casa])).toEqual({
      kind: 'create',
      name: 'Nueva',
    })
  })

  it('recorta el nombre a 60: la columna de categorias no pregunta mas', () => {
    const name = 'a'.repeat(80)
    expect(resolveAcceptCategory({ categoryName: name }, [])).toEqual({
      kind: 'create',
      name: 'a'.repeat(60),
    })
  })
})
