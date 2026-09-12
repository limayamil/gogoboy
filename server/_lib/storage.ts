import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { HttpError } from './http.ts'

/**
 * Almacenamiento de adjuntos contra cualquier bucket S3-compatible.
 * El endpoint sale de variables de entorno a proposito: apuntar esto al bucket de
 * Neon, a Cloudflare R2 o a S3 es un cambio de .env, no de codigo.
 */

const endpoint = process.env.S3_ENDPOINT
const bucket = process.env.S3_BUCKET
const accessKeyId = process.env.S3_ACCESS_KEY_ID
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
const region = process.env.S3_REGION || 'auto'

export const storageConfigured = Boolean(endpoint && bucket && accessKeyId && secretAccessKey)

function client(): S3Client {
  if (!storageConfigured) {
    throw new HttpError(
      503,
      'El almacenamiento de adjuntos no esta configurado. Completa S3_ENDPOINT, S3_BUCKET, ' +
        'S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY en el .env.',
    )
  }
  return new S3Client({
    region,
    endpoint,
    // Los buckets S3-compatibles (Neon, R2, MinIO) necesitan rutas tipo /bucket/key.
    forcePathStyle: true,
    credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
  })
}

/** Clave unica y sin caracteres raros, agrupada por tarea para poder inspeccionar el bucket. */
export function buildObjectKey(taskId: string, fileName: string): string {
  const safe = fileName.replace(/[^\w.\-]+/g, '_').slice(-80)
  return `tasks/${taskId}/${crypto.randomUUID()}-${safe}`
}

export function signUpload(objectKey: string, contentType: string): Promise<string> {
  return getSignedUrl(
    client(),
    new PutObjectCommand({ Bucket: bucket, Key: objectKey, ContentType: contentType }),
    { expiresIn: 600 },
  )
}

export function signDownload(objectKey: string): Promise<string> {
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket, Key: objectKey }), {
    expiresIn: 3600,
  })
}

export async function deleteObject(objectKey: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }))
}
