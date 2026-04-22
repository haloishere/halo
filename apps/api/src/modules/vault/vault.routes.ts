import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { VAULT_TOPICS, vaultEntryInputSchema, vaultEntryUpdateSchema } from '@halo/shared'
import { verifyAuth, requireDbUser } from '../../middleware/auth.js'
import {
  createEntry,
  listEntriesByTopic,
  deleteEntry,
  deleteEntriesByTopic,
  updateEntry,
} from './vault.service.js'

const listQuerySchema = z.object({
  topic: z.enum(VAULT_TOPICS),
})

const idParamsSchema = z.object({
  id: z.string().uuid(),
})

export default async function vaultRoutes(app: FastifyInstance) {
  const preHandler = [verifyAuth, requireDbUser]

  // POST /v1/vault/entries — save a memory. Audits `vault.write` in the repo.
  app.post(
    '/entries',
    { preHandler, schema: { body: vaultEntryInputSchema } },
    async (request, reply) => {
      const userId = request.user.dbUserId!
      const body = request.body as z.infer<typeof vaultEntryInputSchema>
      const record = await createEntry(request.server.db, userId, body, request.log)
      return reply.code(201).send({ success: true, data: record })
    },
  )

  // GET /v1/vault/entries?topic=... — list memories for a scenario. Audits
  // `vault.read` in the repo with `metadata: { topic, count }`.
  app.get(
    '/entries',
    { preHandler, schema: { querystring: listQuerySchema } },
    async (request, reply) => {
      const userId = request.user.dbUserId!
      const { topic } = request.query as z.infer<typeof listQuerySchema>
      const entries = await listEntriesByTopic(request.server.db, userId, topic, request.log)
      return reply.send({ success: true, data: entries })
    },
  )

  // PATCH /v1/vault/entries/:id — update subject/notes. Audits `vault.update`.
  app.patch(
    '/entries/:id',
    { preHandler, schema: { params: idParamsSchema, body: vaultEntryUpdateSchema } },
    async (request, reply) => {
      const userId = request.user.dbUserId!
      const { id } = request.params as z.infer<typeof idParamsSchema>
      const body = request.body as z.infer<typeof vaultEntryUpdateSchema>
      const record = await updateEntry(request.server.db, userId, id, body, request.log)
      return reply.send({ success: true, data: record })
    },
  )

  // DELETE /v1/vault/entries?topic=... — wipe all memories for a topic (retake flow).
  app.delete(
    '/entries',
    { preHandler, schema: { querystring: listQuerySchema } },
    async (request, reply) => {
      const userId = request.user.dbUserId!
      const { topic } = request.query as z.infer<typeof listQuerySchema>
      await deleteEntriesByTopic(request.server.db, userId, topic)
      return reply.code(204).send()
    },
  )

  // DELETE /v1/vault/entries/:id — soft-delete a memory. Audits `vault.delete`.
  app.delete(
    '/entries/:id',
    { preHandler, schema: { params: idParamsSchema } },
    async (request, reply) => {
      const userId = request.user.dbUserId!
      const { id } = request.params as z.infer<typeof idParamsSchema>
      await deleteEntry(request.server.db, userId, id, request.log)
      return reply.code(204).send()
    },
  )
}
