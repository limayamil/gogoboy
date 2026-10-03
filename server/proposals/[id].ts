import { acceptProposal, discardProposal } from '../_lib/proposals.ts'
import { body, notFound, requireId, route } from '../_lib/http.ts'

export default route({
  async POST(req, res) {
    const result = await acceptProposal(requireId(req), body(req))
    res.status(200).json(result)
  },

  async DELETE(req, res) {
    const removed = await discardProposal(requireId(req))
    if (!removed) notFound('Propuesta no encontrada')
    res.status(204).end()
  },
})
