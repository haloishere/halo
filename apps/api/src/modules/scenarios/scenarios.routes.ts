import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { VAULT_TOPICS, questionnaireAnswersRequestSchema } from '@halo/shared'
import { verifyAuth, requireDbUser } from '../../middleware/auth.js'
import { getQuestionnaire, generateFollowups, generateProposals } from './scenarios.service.js'

const topicParamsSchema = z.object({
  topic: z.enum(VAULT_TOPICS),
})

const LLM_RATE_LIMIT = {
  keyGenerator: (request: { user?: { dbUserId?: string }; ip: string }) =>
    request.user?.dbUserId ?? request.ip,
}

export default async function scenariosRoutes(app: FastifyInstance) {
  const preHandler = [verifyAuth, requireDbUser]

  // GET /v1/scenarios/:topic/questionnaire — static curated questions
  app.get(
    '/:topic/questionnaire',
    { preHandler, schema: { params: topicParamsSchema } },
    async (request, reply) => {
      const { topic } = request.params as z.infer<typeof topicParamsSchema>
      const questions = getQuestionnaire(topic)
      return reply.send({ success: true, data: { questions } })
    },
  )

  // POST /v1/scenarios/:topic/questionnaire/followups — 1 LLM follow-up
  app.post(
    '/:topic/questionnaire/followups',
    {
      preHandler,
      config: { rateLimit: { max: 20, timeWindow: '1 hour', ...LLM_RATE_LIMIT } },
      schema: { params: topicParamsSchema, body: questionnaireAnswersRequestSchema },
    },
    async (request, reply) => {
      const { topic } = request.params as z.infer<typeof topicParamsSchema>
      const { answers } = request.body as z.infer<typeof questionnaireAnswersRequestSchema>
      const followups = await generateFollowups(topic, answers, request.log)
      return reply.send({ success: true, data: { followups } })
    },
  )

  // POST /v1/scenarios/:topic/questionnaire/submit — Gemini-consolidated proposals
  app.post(
    '/:topic/questionnaire/submit',
    {
      preHandler,
      config: { rateLimit: { max: 10, timeWindow: '1 hour', ...LLM_RATE_LIMIT } },
      schema: { params: topicParamsSchema, body: questionnaireAnswersRequestSchema },
    },
    async (request, reply) => {
      const { topic } = request.params as z.infer<typeof topicParamsSchema>
      const { answers } = request.body as z.infer<typeof questionnaireAnswersRequestSchema>
      const proposals = await generateProposals(topic, answers, request.log)
      return reply.send({ success: true, data: { proposals } })
    },
  )
}
