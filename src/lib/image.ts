/**
 * Compresion de imagenes en el navegador, antes de subirlas al bucket.
 *
 * Una foto de celular pesa varios MB y en el modal nunca se ve mas grande que la
 * pantalla, asi que guardar el original es tirar bucket a la basura. Se comprime aca
 * y no en el servidor porque la funcion serverless tendria que recibir el archivo
 * entero (hoy ni lo toca: el navegador sube directo con URL prefirmada) y cargar una
 * libreria de imagenes que no necesita para nada mas.
 *
 * Regla de oro: ante cualquier duda se devuelve el archivo original. Perder calidad
 * es aceptable; perder el adjunto no.
 */

/** Lado mas largo, en pixeles. Alcanza para verla a pantalla completa. */
export const MAX_EDGE = 1600

const QUALITY = 0.8

/** GIF perderia la animacion al rasterizarse; SVG es vectorial y ya no pesa nada. */
const KEEP_AS_IS = new Set(['image/gif', 'image/svg+xml'])

export function shouldCompress(contentType: string): boolean {
  return contentType.startsWith('image/') && !KEEP_AS_IS.has(contentType)
}

/** Escala para que ningun lado pase `maxEdge`. Nunca agranda ni devuelve un lado en cero. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height }
  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** `foto.jpg` -> `foto.webp`, para que el nombre no mienta sobre el contenido. */
export function webpName(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  // `dot > 0` y no `>= 0`: en ".gitignore" ese punto es el principio del nombre.
  return `${dot > 0 ? fileName.slice(0, dot) : fileName}.webp`
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', QUALITY))
}

/**
 * Devuelve una version WebP redimensionada, o el archivo original si no conviene
 * tocarlo (no es imagen, el navegador no supo decodificarlo, o el resultado pesaba
 * mas que el original — pasa con imagenes chicas ya optimizadas).
 */
export async function compressImage(file: File): Promise<File> {
  if (!shouldCompress(file.type)) return file

  let bitmap: ImageBitmap
  try {
    // Falla con formatos que el navegador no decodifica (HEIC en la mayoria) y con
    // archivos corruptos. En los dos casos sube el original y que decida el bucket.
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_EDGE)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await toBlob(canvas)
    // Un navegador sin WebP no avisa: devuelve un PNG con otro `type`. Y si el
    // resultado no achico nada, no hay motivo para degradar la imagen.
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file

    return new File([blob], webpName(file.name), {
      type: 'image/webp',
      lastModified: file.lastModified,
    })
  } finally {
    // El bitmap descomprimido ocupa ancho*alto*4 bytes; con varias fotos seguidas
    // esperar al GC es pedir que la pestaña se quede sin memoria.
    bitmap.close()
  }
}
