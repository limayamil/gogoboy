import type { AppState } from '../../src/shared/types.ts'
import {
  callProposalTool,
  callTool,
  isProposalWriteTool,
  listTools,
  type McpClock,
  type ProposalStore,
} from './mcp-tools.ts'

export interface McpDeps {
  loadState: () => Promise<AppState>
  clock: McpClock
  proposals: ProposalStore
}

export interface McpHttpResult {
  status: number
  body: unknown | null
}

const PROTOCOL = '2025-03-26'

type JsonRpc = {
  jsonrpc?: unknown
  id?: unknown
  method?: unknown
  params?: unknown
}

/**
 * MCP JSON-RPC de un request. Stateless a proposito: Grok (y Vercel) no
 * mantienen sesion entre POSTs. Las lecturas proyectan el estado ya cargado;
 * proponer escribe solo en la bandeja y no crea tareas ni categorias.
 */
export async function handleMcpMessage(raw: unknown, deps: McpDeps): Promise<McpHttpResult> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return jsonRpcError(null, -32600, 'Request invalido')
  }

  const message = raw as JsonRpc
  if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return jsonRpcError(idOf(message), -32600, 'Request invalido')
  }

  const id = idOf(message)
  const isNotification = id === undefined

  try {
    const result = await dispatch(message.method, message.params, deps)
    if (isNotification) return { status: 204, body: null }
    return { status: 200, body: { jsonrpc: '2.0', id, result } }
  } catch (error) {
    const text = error instanceof Error ? error.message : 'Error interno'
    const code = text.startsWith('Metodo no encontrado') ? -32601 : -32603
    if (isNotification) return { status: 204, body: null }
    return jsonRpcError(id, code, text)
  }
}

async function dispatch(method: string, params: unknown, deps: McpDeps): Promise<unknown> {
  switch (method) {
    case 'initialize':
      return {
        protocolVersion: negotiatedVersion(params),
        capabilities: { tools: {} },
        serverInfo: { name: 'gogoboy', version: '0.1.0' },
        instructions:
          'GoGoBoy es la lista personal del usuario. Usa hoy, semana, tareas y notas para leer. categorias lista las que ya existen; propuestas lista la bandeja. podes proponer, actualizar_propuesta y descartar_propuesta. No podes crear tareas ni categorias: eso lo decide el usuario al tomar. Las notas tipo password no estan disponibles.',
      }
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null
    case 'ping':
      return {}
    case 'tools/list':
      return { tools: listTools() }
    case 'tools/call':
      return callNamedTool(params, deps)
    default:
      throw new Error(`Metodo no encontrado: ${method}`)
  }
}

async function callNamedTool(params: unknown, deps: McpDeps) {
  const name = params && typeof params === 'object' ? (params as { name?: unknown }).name : undefined
  const argsRaw =
    params && typeof params === 'object' ? (params as { arguments?: unknown }).arguments : undefined
  if (typeof name !== 'string' || !name) {
    throw new Error('Falta el nombre de la herramienta')
  }
  const args =
    argsRaw && typeof argsRaw === 'object' && !Array.isArray(argsRaw)
      ? (argsRaw as Record<string, unknown>)
      : {}

  try {
    // Las de escritura no cargan el estado: no tienen que ver tasks para proponer.
    const payload = isProposalWriteTool(name)
      ? await callProposalTool(name, args, deps.proposals)
      : callTool(name, args, await deps.loadState(), deps.clock)
    return {
      content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    }
  } catch (error) {
    const text = error instanceof Error ? error.message : 'Error al ejecutar la herramienta'
    return {
      content: [{ type: 'text', text }],
      isError: true,
    }
  }
}

function negotiatedVersion(params: unknown): string {
  const requested =
    params && typeof params === 'object'
      ? (params as { protocolVersion?: unknown }).protocolVersion
      : undefined
  return typeof requested === 'string' && requested.trim() ? requested : PROTOCOL
}

function idOf(message: JsonRpc): string | number | null | undefined {
  if (!('id' in message)) return undefined
  const id = message.id
  if (id === null || typeof id === 'string' || typeof id === 'number') return id
  return null
}

function jsonRpcError(
  id: string | number | null | undefined,
  code: number,
  message: string,
): McpHttpResult {
  return {
    status: 200,
    body: { jsonrpc: '2.0', id: id ?? null, error: { code, message } },
  }
}
