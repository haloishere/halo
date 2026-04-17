import type { FastifyInstance } from 'fastify'
import type { z } from 'zod'
import { verifyAuth, requireDbUser } from '../../middleware/auth.js'
import { writeAuditLog } from '../../lib/audit.js'
import { getAiClient, type AiTool } from '../../lib/vertex-ai.js'
import { CircuitBreaker } from '../../lib/circuit-breaker.js'
import {
  createConversationSchema,
  listConversationsQuerySchema,
  conversationParamsSchema,
  feedbackParamsSchema,
  submitFeedbackSchema,
  sendMessageSchema,
} from '@halo/shared'
import {
  createConversation,
  listConversations,
  getConversation,
  getConversationMessages,
  deleteConversation,
  saveMessage,
  submitFeedback,
  autoTitleConversation,
} from './ai-chat.service.js'
import { buildSystemPrompt } from './system-prompt.js'
import { buildConversationContext } from './context-builder.js'
import { streamAiResponse } from './streaming.service.js'
import { writeSSEHeaders, writeSSEChunk, writeSSEDone, writeSSEError } from './sse.js'
import { getProfile } from '../users/users.service.js'
import { runSafetyPipeline, classifyOutput } from './safety/index.js'

// Module-level circuit breaker shared across requests
const circuitBreaker = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 30_000 })

// RAG tools config — built once from env var
function buildRagTools(): AiTool[] | undefined {
  const corpus = process.env.VERTEX_AI_RAG_CORPUS
  if (!corpus) return undefined
  return [{ retrieval: { vertexRagStore: { ragResources: [{ ragCorpus: corpus }] } } }]
}

const ragTools = buildRagTools()

// SSE connection timeout — prevents abandoned clients from holding connections indefinitely
const SSE_TIMEOUT_MS = 120_000

export default async function aiChatRoutes(app: FastifyInstance) {
  const preHandler = [verifyAuth, requireDbUser]

  // POST /v1/ai/conversations
  app.post(
    '/conversations',
    {
      preHandler,
      schema: { body: createConversationSchema },
    },
    async (request, reply) => {
      const userId = request.user.dbUserId!
      const record = await createConversation(
        request.server.db,
        userId,
        request.body as z.infer<typeof createConversationSchema>,
        request.log,
      )

      await writeAuditLog(
        request.server.db,
        {
          userId,
          action: 'ai.conversation.create',
          resource: 'ai_conversation',
          resourceId: record.id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
        request.log,
      )

      return reply.code(201).send({ success: true, data: record })
    },
  )

  // GET /v1/ai/conversations
  app.get(
    '/conversations',
    {
      preHandler,
      schema: { querystring: listConversationsQuerySchema },
    },
    async (request, reply) => {
      const userId = request.user.dbUserId!
      const { cursor, limit } = request.query as z.infer<typeof listConversationsQuerySchema>

      const result = await listConversations(request.server.db, userId, cursor, limit)

      return reply.send({
        success: true,
        data: result.conversations,
        meta: { nextCursor: result.nextCursor },
      })
    },
  )

  // GET /v1/ai/conversations/:id
  app.get(
    '/conversations/:id',
    {
      preHandler,
      schema: { params: conversationParamsSchema },
    },
    async (request, reply) => {
      const userId = request.user.dbUserId!
      const { id } = request.params as z.infer<typeof conversationParamsSchema>

      const conversation = await getConversation(request.server.db, userId, id)
      const messages = await getConversationMessages(request.server.db, userId, id, request.log)

      return reply.send({
        success: true,
        data: { ...conversation, messages },
      })
    },
  )

  // DELETE /v1/ai/conversations/:id
  app.delete(
    '/conversations/:id',
    {
      preHandler,
      schema: { params: conversationParamsSchema },
    },
    async (request, reply) => {
      const userId = request.user.dbUserId!
      const { id } = request.params as z.infer<typeof conversationParamsSchema>

      await deleteConversation(request.server.db, userId, id, request.log)

      await writeAuditLog(
        request.server.db,
        {
          userId,
          action: 'ai.conversation.delete',
          resource: 'ai_conversation',
          resourceId: id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
        request.log,
      )

      return reply.code(204).send()
    },
  )

  // POST /v1/ai/conversations/:id/feedback/:messageId
  app.post(
    '/conversations/:id/feedback/:messageId',
    {
      preHandler,
      schema: {
        params: feedbackParamsSchema,
        body: submitFeedbackSchema,
      },
    },
    async (request, reply) => {
      const userId = request.user.dbUserId!
      const { id, messageId } = request.params as z.infer<typeof feedbackParamsSchema>
      const body = request.body as z.infer<typeof submitFeedbackSchema>

      const updated = await submitFeedback(
        request.server.db,
        userId,
        id,
        messageId,
        body,
        request.log,
      )

      await writeAuditLog(
        request.server.db,
        {
          userId,
          action: 'ai.message.feedback',
          resource: 'ai_message',
          resourceId: messageId,
          metadata: { rating: body.rating, conversationId: id },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
        request.log,
      )

      return reply.send({ success: true, data: updated })
    },
  )

  // POST /v1/ai/conversations/:id/messages — SSE streaming
  app.post(
    '/conversations/:id/messages',
    {
      preHandler,
      config: {
        rateLimit: {
          max: 50,
          timeWindow: '1 hour',
          keyGenerator: (request: { user?: { dbUserId?: string }; ip: string }) =>
            request.user?.dbUserId ?? request.ip,
        },
      },
      schema: {
        params: conversationParamsSchema,
        body: sendMessageSchema,
      },
    },
    async (request, reply) => {
      const userId = request.user.dbUserId!
      const { id: conversationId } = request.params as z.infer<typeof conversationParamsSchema>
      const { content } = request.body as z.infer<typeof sendMessageSchema>

      // Verify conversation ownership (reuse result to gate auto-title later)
      const conversation = await getConversation(request.server.db, userId, conversationId)

      // Safety pipeline — check input BEFORE streaming
      const safety = runSafetyPipeline(content)
      if (!safety.allowed) {
        request.log.warn(
          { reason: safety.rejectionReason, category: safety.inputClassification.category },
          'Input blocked by safety pipeline',
        )
        return reply.code(422).send({
          success: false,
          error: 'Your message could not be processed',
        })
      }

      // Save user message (encrypted)
      await saveMessage(request.server.db, userId, conversationId, 'user', content)

      // Fetch conversation history for context
      const messages = await getConversationMessages(
        request.server.db,
        userId,
        conversationId,
        request.log,
      )

      // Build context
      const user = await getProfile(request.server.db, userId)
      const systemPrompt = buildSystemPrompt(
        {
          displayName: user?.displayName ?? undefined,
          city: null,
          vaultEntries: null,
        },
        { ragEnabled: !!ragTools },
      )

      const contents = buildConversationContext(
        messages.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
          createdAt: m.createdAt,
        })),
      )

      // Get AI client (may not be initialized in test/dev without Vertex AI)
      let aiClient
      try {
        aiClient = getAiClient()
      } catch (err) {
        request.log.error({ err }, 'AI client not available')
        return reply.code(503).send({
          success: false,
          error: 'AI service is not available',
        })
      }

      // Hijack the response for SSE streaming
      reply.hijack()
      writeSSEHeaders(reply)

      // Send crisis resources before streaming (non-blocking — does not prevent response)
      if (safety.crisisResult.detected && safety.crisisResult.resources) {
        writeSSEChunk(reply.raw, 'crisis_resources', {
          resources: safety.crisisResult.resources,
        })
      }

      const connectionTimer = setTimeout(() => {
        if (!reply.raw.writableEnded) {
          writeSSEError(reply.raw, { message: 'Connection timed out' })
        }
      }, SSE_TIMEOUT_MS)

      let fullResponse = ''
      let tokenCount = 0
      let safetyBlocked = false
      let streamCompleted = false

      let streamEnded = false

      try {
        for await (const event of streamAiResponse({
          aiClient,
          circuitBreaker,
          systemPrompt,
          contents,
          options: ragTools ? { tools: ragTools } : undefined,
          logger: request.log,
        })) {
          if (streamEnded) break

          switch (event.type) {
            case 'chunk':
              fullResponse += event.text
              writeSSEChunk(reply.raw, 'message', { text: event.text })
              break

            case 'done':
              fullResponse = event.fullResponse
              tokenCount = event.tokenCount
              streamCompleted = true
              break

            case 'safety_block':
              safetyBlocked = true
              writeSSEChunk(reply.raw, 'safety_block', { message: event.message })
              writeSSEDone(reply.raw)
              streamEnded = true
              break

            case 'error':
              writeSSEError(reply.raw, { message: event.error })
              if (event.partial) {
                fullResponse = event.partial
              }
              streamEnded = true
              break

            default: {
              const _exhaustive: never = event
              throw new Error(`Unhandled stream event: ${(_exhaustive as { type: string }).type}`)
            }
          }
        }
      } catch (err) {
        clearTimeout(connectionTimer)
        request.log.error({ err }, 'SSE streaming error')
        if (!reply.raw.writableEnded) {
          writeSSEError(reply.raw, { message: 'Streaming interrupted' })
        }
      }

      clearTimeout(connectionTimer)

      // Layer 3: Output classifier — runs AFTER stream completes. The user has already seen
      // the streamed response. If unsafe, we send a safety_block event so the client can retract
      // the displayed content, and save the safe replacement to the DB. This is an audit + retraction
      // layer, not a pre-delivery filter. Gemini's built-in safety is the primary defense.
      if (streamCompleted && fullResponse && !safetyBlocked) {
        try {
          const outputResult = await classifyOutput(aiClient, fullResponse, request.log)
          if (!outputResult.safe) {
            request.log.warn(
              { reason: outputResult.reason, category: outputResult.category },
              'Output classified as unsafe — replacing response',
            )
            fullResponse =
              "I'm not able to provide that kind of advice. Let's focus on how I can support you as a caregiver."
            if (!reply.raw.writableEnded) {
              writeSSEChunk(reply.raw, 'safety_block', { message: fullResponse })
            }
          }
        } catch (err) {
          request.log.error({ err }, 'Output classifier error (failing open)')
        }
      }

      // Close SSE connection if still open
      if (!reply.raw.writableEnded) {
        writeSSEDone(reply.raw)
      }

      // Save assistant message (encrypted) — async, errors logged but non-blocking
      if (streamCompleted && fullResponse && !safetyBlocked) {
        saveMessage(
          request.server.db,
          userId,
          conversationId,
          'assistant',
          fullResponse,
          tokenCount || null,
        ).catch((err) => {
          request.log.error({ err, conversationId }, 'Failed to save assistant message')
        })

        writeAuditLog(
          request.server.db,
          {
            userId,
            action: 'ai.message.send',
            resource: 'ai_message',
            metadata: { conversationId, tokenCount },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          },
          request.log,
        ).catch((err) => {
          request.log.warn({ err, conversationId }, 'Audit log write failed')
        })

        // Auto-generate title for untitled conversations (fire-and-forget).
        // Skip when circuit breaker is open (Vertex AI down) but don't use execute() —
        // autoTitleConversation swallows errors internally, so execute() would always
        // call onSuccess() and reset the breaker's failure counter.
        if (!conversation.title && circuitBreaker.getState() !== 'open') {
          void autoTitleConversation(
            request.server.db,
            aiClient,
            userId,
            conversationId,
            content,
            request.log,
          ).catch((err) => {
            request.log.warn({ err, conversationId }, 'Auto-title failed')
          })
        }
      }
    },
  )
}
