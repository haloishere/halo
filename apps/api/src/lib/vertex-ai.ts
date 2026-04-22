import type { FastifyBaseLogger } from 'fastify'

export type AiContentPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } }

export interface AiContent {
  role: 'user' | 'model'
  parts: AiContentPart[]
}

export interface AiStreamChunk {
  text: string
  functionCall?: { name: string; args: Record<string, unknown> }
  finishReason?: string
  safetyRatings?: Array<{ category: string; probability: string; blocked?: boolean }>
}

export interface AiTokenCount {
  totalTokens: number
  totalBillableCharacters?: number
}

export interface AiRagRetrieval {
  vertexRagStore: {
    ragResources: Array<{ ragCorpus: string }>
    similarityTopK?: number
    vectorDistanceThreshold?: number
  }
}

export interface AiFunctionDeclaration {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
}

export type AiTool =
  | { retrieval: AiRagRetrieval }
  | { functionDeclarations: AiFunctionDeclaration[] }

export interface AiGenerateOptions {
  tools?: AiTool[]
}

export interface AiClient {
  generateContentStream(
    systemPrompt: string,
    contents: AiContent[],
    options?: AiGenerateOptions,
  ): AsyncGenerator<AiStreamChunk, void, unknown>
  generateContent(
    systemPrompt: string,
    contents: AiContent[],
    options?: AiGenerateOptions,
  ): Promise<string>
  countTokens(contents: AiContent[]): Promise<AiTokenCount>
}

export interface AiClientConfig {
  project: string
  location: string
  model: string
}

function validateConfig(): AiClientConfig {
  const project = process.env.VERTEX_AI_PROJECT
  const location = process.env.VERTEX_AI_LOCATION
  const model = process.env.VERTEX_AI_MODEL

  if (!project) throw new Error('VERTEX_AI_PROJECT env var is required')
  if (!location) throw new Error('VERTEX_AI_LOCATION env var is required')
  if (!model) throw new Error('VERTEX_AI_MODEL env var is required')

  return { project, location, model }
}

export function createAiClient(_logger?: FastifyBaseLogger): AiClient {
  const config = validateConfig()

  // Lazily import to avoid loading the SDK in test environments
  let clientPromise: Promise<{
    getGenerativeModel: (opts: { model: string }) => unknown
  }> | null = null

  async function getClient() {
    if (!clientPromise) {
      clientPromise = import('@google-cloud/vertexai').then(({ VertexAI }) => {
        return new VertexAI({
          project: config.project,
          location: config.location,
        })
      })
    }
    return clientPromise
  }

  return {
    async *generateContentStream(
      systemPrompt: string,
      contents: AiContent[],
      options?: AiGenerateOptions,
    ): AsyncGenerator<AiStreamChunk, void, unknown> {
      const vertexAi = await getClient()
      const model = vertexAi.getGenerativeModel({ model: config.model }) as {
        generateContentStream: (opts: {
          systemInstruction: { parts: AiContentPart[] }
          contents: AiContent[]
          tools?: AiTool[]
        }) => Promise<{
          stream: AsyncIterable<{
            candidates?: Array<{
              content?: { parts?: AiContentPart[] }
              finishReason?: string
              safetyRatings?: Array<{ category: string; probability: string; blocked?: boolean }>
            }>
          }>
        }>
      }

      const streamResult = await model.generateContentStream({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        ...(options?.tools && { tools: options.tools }),
      })

      for await (const chunk of streamResult.stream) {
        const candidate = chunk.candidates?.[0]
        const parts = (candidate?.content?.parts ?? []) as Record<string, unknown>[]
        const text =
          (parts.find((p) => typeof p['text'] === 'string')?.['text'] as string | undefined) ?? ''
        const functionCall = parts.find((p) => p['functionCall'] != null)?.['functionCall'] as
          | { name: string; args: Record<string, unknown> }
          | undefined

        yield {
          text,
          functionCall,
          finishReason: candidate?.finishReason,
          safetyRatings: candidate?.safetyRatings,
        }
      }
    },

    async generateContent(
      systemPrompt: string,
      contents: AiContent[],
      options?: AiGenerateOptions,
    ): Promise<string> {
      const vertexAi = await getClient()
      const model = vertexAi.getGenerativeModel({ model: config.model }) as {
        generateContent: (opts: {
          systemInstruction: { parts: AiContentPart[] }
          contents: AiContent[]
          tools?: AiTool[]
        }) => Promise<{
          response: {
            candidates?: Array<{
              content?: { parts?: AiContentPart[] }
            }>
          }
        }>
      }

      const TIMEOUT_MS = 60_000
      const result = await Promise.race([
        model.generateContent({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          ...(options?.tools && { tools: options.tools }),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Vertex AI generateContent timed out after 60s')),
            TIMEOUT_MS,
          ),
        ),
      ])

      const firstPart = result.response.candidates?.[0]?.content?.parts?.[0] as
        | Record<string, unknown>
        | undefined
      return (firstPart?.['text'] as string | undefined) ?? ''
    },

    async countTokens(contents: AiContent[]): Promise<AiTokenCount> {
      const vertexAi = await getClient()
      const model = vertexAi.getGenerativeModel({ model: config.model }) as {
        countTokens: (opts: { contents: AiContent[] }) => Promise<{
          totalTokens: number
          totalBillableCharacters?: number
        }>
      }

      const result = await model.countTokens({ contents })
      return {
        totalTokens: result.totalTokens,
        totalBillableCharacters: result.totalBillableCharacters,
      }
    },
  }
}

// Singleton for server-wide reuse
let _aiClient: AiClient | null = null

export function initAiClient(logger?: FastifyBaseLogger): AiClient {
  if (!_aiClient) {
    _aiClient = createAiClient(logger)
    logger?.info('Vertex AI client initialized')
  }
  return _aiClient
}

export function getAiClient(): AiClient {
  if (!_aiClient) {
    throw new Error('AI client not initialized. Call initAiClient() first.')
  }
  return _aiClient
}

/** Reset singleton — used in tests */
export function _resetAiClient(): void {
  _aiClient = null
}
