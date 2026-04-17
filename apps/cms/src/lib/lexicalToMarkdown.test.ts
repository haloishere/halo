import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SerializedEditorState } from 'lexical'
import type { SanitizedConfig } from 'payload'

vi.mock('@payloadcms/richtext-lexical', () => ({
  editorConfigFactory: {
    default: vi.fn().mockResolvedValue({ resolvedFeatureMap: new Map() }),
  },
  convertLexicalToMarkdown: vi.fn().mockReturnValue('# Mocked markdown'),
}))

import { lexicalToMarkdown } from './lexicalToMarkdown'
import { editorConfigFactory, convertLexicalToMarkdown } from '@payloadcms/richtext-lexical'

const mockEditorConfigFactory = vi.mocked(editorConfigFactory.default)
const mockConvert = vi.mocked(convertLexicalToMarkdown)

const fakeConfig = { serverURL: 'http://test' } as unknown as SanitizedConfig

const fakeLexicalState: SerializedEditorState = {
  root: {
    type: 'root',
    children: [],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  },
}

describe('lexicalToMarkdown', () => {
  beforeEach(() => {
    // Only clear convertLexicalToMarkdown between tests.
    // Do NOT clear mockEditorConfigFactory — we need its call history
    // to persist across the test suite because the module-level cache
    // means it is only invoked once (on the very first call).
    mockConvert.mockClear()
    mockConvert.mockReturnValue('# Mocked markdown')
  })

  // This test MUST run first — it triggers the one-time factory call.
  it('calls editorConfigFactory on first invocation and passes config', async () => {
    // Factory should have been called exactly once by the first lexicalToMarkdown call.
    // It hasn't been called yet because no test has called lexicalToMarkdown.
    expect(mockEditorConfigFactory).toHaveBeenCalledTimes(0)

    await lexicalToMarkdown(fakeLexicalState, fakeConfig)

    expect(mockEditorConfigFactory).toHaveBeenCalledTimes(1)
    expect(mockEditorConfigFactory).toHaveBeenCalledWith({ config: fakeConfig })
  })

  it('converts lexical editor state to markdown string', async () => {
    const result = await lexicalToMarkdown(fakeLexicalState, fakeConfig)

    expect(result).toBe('# Mocked markdown')
  })

  it('calls convertLexicalToMarkdown with data and editor config', async () => {
    await lexicalToMarkdown(fakeLexicalState, fakeConfig)

    expect(mockConvert).toHaveBeenCalledWith({
      data: fakeLexicalState,
      editorConfig: { resolvedFeatureMap: expect.any(Map) },
    })
  })

  it('caches editor config — does not call factory again on subsequent calls', async () => {
    // The factory was already called once in the first test above.
    // Record the current call count, then make multiple calls.
    const callsBefore = mockEditorConfigFactory.mock.calls.length

    await lexicalToMarkdown(fakeLexicalState, fakeConfig)
    await lexicalToMarkdown(fakeLexicalState, fakeConfig)
    await lexicalToMarkdown(fakeLexicalState, fakeConfig)

    // No additional calls to the factory — the cached config is reused.
    expect(mockEditorConfigFactory).toHaveBeenCalledTimes(callsBefore)
  })

  it('returns whatever convertLexicalToMarkdown returns', async () => {
    mockConvert.mockReturnValueOnce('## Custom heading\n\nBody text')

    const result = await lexicalToMarkdown(fakeLexicalState, fakeConfig)

    expect(result).toBe('## Custom heading\n\nBody text')
  })

  it('propagates errors from convertLexicalToMarkdown', async () => {
    mockConvert.mockImplementationOnce(() => {
      throw new Error('Conversion failed')
    })

    await expect(lexicalToMarkdown(fakeLexicalState, fakeConfig)).rejects.toThrow(
      'Conversion failed',
    )
  })
})
