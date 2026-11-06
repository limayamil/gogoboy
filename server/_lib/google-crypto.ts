/**
 * Cifrado del refresh token y firma del `state` de OAuth. Las dos cosas salen de
 * GOOGLE_TOKEN_KEY (32 bytes en base64): el cifrado la usa tal cual y la firma usa
 * una clave derivada, para no reutilizar la misma clave en dos algoritmos.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const VERSION = 'v1'

/** null si falta o no son exactamente 32 bytes: mejor no ofrecer Google que cifrar con una clave corta. */
export function parseTokenKey(raw: string | undefined): Buffer | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  const key = Buffer.from(trimmed, 'base64')
  return key.length === 32 ? key : null
}

export function encryptToken(plain: string, key: Buffer): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64'), tag.toString('base64'), data.toString('base64')].join(':')
}

/** Tira si el texto fue alterado o la clave no es la misma (GCM verifica el tag). */
export function decryptToken(blob: string, key: Buffer): string {
  const [version, iv, tag, data] = blob.split(':')
  if (version !== VERSION || !iv || !tag || data == null) throw new Error('Token cifrado con formato desconocido')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8')
}

// --- state de OAuth -------------------------------------------------------------

export const STATE_COOKIE = 'gogoboy_google_oauth'
export const STATE_TTL_MS = 10 * 60_000

interface StatePayload {
  /** Nonce que además viaja en una cookie HttpOnly del navegador que inició el flujo. */
  n: string
  /** redirect_uri exacto que se mandó a Google: el canje del code tiene que repetirlo. */
  r: string
  /** Vence en (ms). */
  e: number
}

function stateKey(key: Buffer): Buffer {
  return createHmac('sha256', key).update('gogoboy/google-oauth-state').digest()
}

function sign(body: string, key: Buffer): string {
  return createHmac('sha256', stateKey(key)).update(body).digest('base64url')
}

export function createOAuthState(key: Buffer, redirectUri: string, now = Date.now()): { state: string; nonce: string } {
  const nonce = randomBytes(24).toString('base64url')
  const body = Buffer.from(JSON.stringify({ n: nonce, r: redirectUri, e: now + STATE_TTL_MS } satisfies StatePayload)).toString(
    'base64url',
  )
  return { state: `${body}.${sign(body, key)}`, nonce }
}

/**
 * El state solo vale si lo firmamos nosotros, no venció y su nonce coincide con la
 * cookie de este navegador. Así un link armado por otro (CSRF de login) no conecta
 * una cuenta ajena: el atacante no tiene la cookie de la víctima.
 */
export function verifyOAuthState(
  state: string | undefined,
  cookieNonce: string | undefined,
  key: Buffer,
  now = Date.now(),
): { redirectUri: string } | null {
  if (!state || !cookieNonce) return null
  const [body, signature] = state.split('.')
  if (!body || !signature) return null
  const expected = Buffer.from(sign(body, key))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null

  let payload: StatePayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StatePayload
  } catch {
    return null
  }
  if (typeof payload.e !== 'number' || payload.e < now) return null
  if (typeof payload.n !== 'string' || typeof payload.r !== 'string') return null
  const a = Buffer.from(payload.n)
  const b = Buffer.from(cookieNonce)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return { redirectUri: payload.r }
}

export function readCookie(header: string | string[] | undefined, name: string): string | undefined {
  const raw = Array.isArray(header) ? header.join('; ') : header
  if (!raw) return undefined
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

/** La cookie solo viaja al callback y dura lo mismo que el state. */
export function stateCookie(nonce: string, secure: boolean): string {
  return [
    `${STATE_COOKIE}=${encodeURIComponent(nonce)}`,
    'Path=/api/google',
    `Max-Age=${STATE_TTL_MS / 1000}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ')
}

export function clearStateCookie(): string {
  return `${STATE_COOKIE}=; Path=/api/google; Max-Age=0; HttpOnly; SameSite=Lax`
}
