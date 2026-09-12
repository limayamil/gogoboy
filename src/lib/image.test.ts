import { describe, expect, it } from 'vitest'
import { MAX_EDGE, fitWithin, shouldCompress, webpName } from './image'

describe('fitWithin', () => {
  it('deja intacta una imagen que ya entra en el limite', () => {
    expect(fitWithin(900, 600, MAX_EDGE)).toEqual({ width: 900, height: 600 })
  })

  it('no agranda una imagen chica hasta el limite', () => {
    expect(fitWithin(200, 100, MAX_EDGE)).toEqual({ width: 200, height: 100 })
  })

  it('achica por el lado mas largo y conserva la proporcion', () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 })
  })

  it('toma el alto como lado mas largo en una imagen vertical', () => {
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 })
  })

  it('redondea a enteros: el canvas no dibuja medios pixeles', () => {
    expect(fitWithin(2561, 1441, 1600)).toEqual({ width: 1600, height: 900 })
  })

  it('nunca devuelve un lado en cero, por angosta que sea la imagen', () => {
    expect(fitWithin(5000, 1, 1600)).toEqual({ width: 1600, height: 1 })
  })
})

describe('webpName', () => {
  it('cambia la extension', () => {
    expect(webpName('foto.jpg')).toBe('foto.webp')
  })

  it('respeta los puntos del nombre y solo toca el ultimo', () => {
    expect(webpName('captura.final.v2.png')).toBe('captura.final.v2.webp')
  })

  it('agrega la extension si el archivo no tenia', () => {
    expect(webpName('imagen')).toBe('imagen.webp')
  })

  it('no confunde un nombre que empieza con punto con una extension', () => {
    expect(webpName('.gitignore')).toBe('.gitignore.webp')
  })
})

describe('shouldCompress', () => {
  it('acepta las imagenes que el canvas sabe rasterizar', () => {
    expect(shouldCompress('image/jpeg')).toBe(true)
    expect(shouldCompress('image/png')).toBe(true)
    expect(shouldCompress('image/heic')).toBe(true)
  })

  it('deja pasar el PDF sin tocarlo', () => {
    expect(shouldCompress('application/pdf')).toBe(false)
  })

  it('deja pasar el GIF: rasterizarlo perderia la animacion', () => {
    expect(shouldCompress('image/gif')).toBe(false)
  })

  it('deja pasar el SVG: es vectorial y ya pesa nada', () => {
    expect(shouldCompress('image/svg+xml')).toBe(false)
  })

  it('igual procesa un webp: puede venir enorme y hay que achicarlo', () => {
    expect(shouldCompress('image/webp')).toBe(true)
  })

  it('trata el tipo vacio como no comprimible', () => {
    expect(shouldCompress('')).toBe(false)
  })
})
