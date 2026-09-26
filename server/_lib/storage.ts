import { HttpError } from './http.ts'
import {
  accessKeyId,
  bucket,
  endpoint,
  region,
  secretAccessKey,
  storageConfigured,
} from './storage-config.ts'

/**
 * Almacenamiento de adjuntos contra cualquier bucket S3-compatible.
 * El endpoint sale de variables de entorno a proposito: apuntar esto al bucket de
 * Neon, a Cloudflare R2 o a S3 es un cambio de .env, no de codigo.
 *
 * El SDK entra por import dinamico: solo los tres endpoints de adjuntos lo necesitan,
 * y solo cuando se usan de verdad.
 */

export { storageConfigured }

async function client() {
  if (!storageConfigured) {
    throw new HttpError(
      503,
      'El almacenamiento de adjuntos no esta configurado. Completa S3_ENDPOINT, S3_BUCKET, ' +
        'S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY en el .env.',
    )
  }
  const { S3Client } = await import('@aws-sdk/client-s3')
  return new S3Client({
    region,
    endpoint,
    // Los buckets S3-compatibles (Neon, R2, MinIO) necesitan rutas tipo /bucket/key.
    forcePathStyle: true,
    credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
  })
}

/** Clave unica y sin caracteres raros, agrupada por duenio para poder inspeccionar el bucket. */
export function buildObjectKey(ownerId: string, fileName: string, folder = 'tasks'): string {
  const safe = fileName.replace(/[^\w.\-]+/g, '_').slice(-80)
  return `${folder}/${ownerId}/${crypto.randomUUID()}-${safe}`
}

export async function signUpload(objectKey: string, contentType: string): Promise<string> {
  const [{ PutObjectCommand }, { getSignedUrl }, s3] = await Promise.all([
    import('@aws-sdk/client-s3'),
    import('@aws-sdk/s3-request-presigner'),
    client(),
  ])
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucket, Key: objectKey, ContentType: contentType }),
    { expiresIn: 600 },
  )
}

export async function signDownload(objectKey: string): Promise<string> {
  const [{ GetObjectCommand }, { getSignedUrl }, s3] = await Promise.all([
    import('@aws-sdk/client-s3'),
    import('@aws-sdk/s3-request-presigner'),
    client(),
  ])
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: objectKey }), {
    expiresIn: 3600,
  })
}

export async function deleteObject(objectKey: string): Promise<void> {
  const [{ DeleteObjectCommand }, s3] = await Promise.all([
    import('@aws-sdk/client-s3'),
    client(),
  ])
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }))
}
