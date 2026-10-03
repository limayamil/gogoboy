import { body, route } from './_lib/http.ts'
import { loadAppState } from './_lib/load-state.ts'
import { handleMcpMessage, type McpDeps } from './_lib/mcp.ts'
import { mcpClock } from './_lib/mcp-clock.ts'
import { proposalStore } from './_lib/proposals.ts'

export function createMcpHandler(deps: {
  loadState: McpDeps['loadState']
  proposals?: McpDeps['proposals']
  now?: () => Date
  timeZone?: string
}) {
  const proposals = deps.proposals ?? proposalStore
  return route({
    async POST(req, res) {
      const now = (deps.now ?? (() => new Date()))()
      const result = await handleMcpMessage(body(req), {
        loadState: deps.loadState,
        clock: mcpClock(now, deps.timeZone),
        proposals,
      })
      if (result.status === 204) {
        res.status(204).end()
        return
      }
      res.status(result.status).json(result.body)
    },
  })
}

export default createMcpHandler({ loadState: loadAppState })
