/**
 * Las variables del bucket, sin arrastrar el SDK.
 *
 * Vive separado de storage.ts porque GET /api/state (y el MCP) solo necesitan el
 * booleano. Como Vercel importa los handlers de forma estatica, tenerlo en el mismo
 * modulo que @aws-sdk hacia que toda request a /api/* pagara el parse de once megas
 * de SDK en el arranque en frio.
 */

export const endpoint = process.env.S3_ENDPOINT
export const bucket = process.env.S3_BUCKET
export const accessKeyId = process.env.S3_ACCESS_KEY_ID
export const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
export const region = process.env.S3_REGION || 'auto'

export const storageConfigured = Boolean(endpoint && bucket && accessKeyId && secretAccessKey)
