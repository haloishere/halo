import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
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
  VAULT_TOPICS,
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
import { extractProposal } from './proposal-parser.js'
import { getProfile } from '../users/users.service.js'
import { findVaultEntriesByTopic } from '../vault/vault.repository.js'
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

      // Defense-in-depth: the conversation row holds `topic` as an untyped
      // string at the Drizzle layer. A drifted/legacy value would silently
      // return zero vault rows via `eq(..., topic)` — the chat agent would
      // then answer with no memory context and no operator signal. Parse
      // once at the route boundary so drift throws loud at 500.
      const conversationTopic = z.enum(VAULT_TOPICS).parse(conversation.topic)

      // Pre-filter by topic so the prompt never leaks cross-scenario
      // memories. Self-read — audit disabled so an N-turn chat doesn't
      // flood `audit_logs` with N identical rows.
      const user = await getProfile(request.server.db, userId)
      const topicEntries = await findVaultEntriesByTopic(
        request.server.db,
        userId,
        conversationTopic,
        request.log,
        { audit: false },
      )

      // Drop failed-decrypt rows — the agent cannot reason over ciphertext
      // sentinels, and the repo already logged `vault.decrypt.failed` per row.
      // Surface the count at the route level so operators see "agent answered
      // with partial view" as a distinct event from "one row corrupt".
      const decryptedEntries = topicEntries.filter(
        (e): e is Exclude<typeof e, { decryptionFailed: true }> => !('decryptionFailed' in e),
      )
      if (decryptedEntries.length < topicEntries.length) {
        request.log.warn(
          {
            userId,
            topic: conversationTopic,
            skipped: topicEntries.length - decryptedEntries.length,
          },
          'chat.vault.entries.dropped',
        )
      }

      const systemPrompt = buildSystemPrompt(
        {
          displayName: user?.displayName ?? undefined,
          city: null,
          topic: conversationTopic,
          vaultEntries: decryptedEntries.map((e) => ({
            // When `notes` is absent, the `subject` already *is* the memory —
            // emit only the label so the prompt doesn't waste tokens repeating
            // the same string as label-and-value.
            label: e.content.subject,
            value: e.content.notes ?? '',
          })),
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

      // Extract memory proposal from the final line before saving. If found,
      // emit an SSE `proposal` event for the client's confirm/reject UI and
      // persist only the cleaned text (without the JSON line). `savedContent`
      // defaults to `fullResponse` so abort/safety paths preserve the raw
      // model output in the transcript audit trail.
      let savedContent = fullResponse
      if (streamCompleted && fullResponse && !safetyBlocked) {
        const { proposal, cleanedText } = extractProposal(fullResponse, request.log)
        if (proposal && !reply.raw.writableEnded) {
          writeSSEChunk(reply.raw, 'proposal', proposal)
        }
        savedContent = cleanedText
      }

      // Close SSE connection if still open
      if (!reply.raw.writableEnded) {
        writeSSEDone(reply.raw)
      }

      // Save assistant message (encrypted) — async, errors logged but non-blocking.
      // Guard on `savedContent.trim()` so a JSON-only reply (cleanedText === '')
      // doesn't persist an empty bubble.
      if (streamCompleted && savedContent.trim() && !safetyBlocked) {
        saveMessage(
          request.server.db,
          userId,
          conversationId,
          'assistant',
          savedContent,
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
