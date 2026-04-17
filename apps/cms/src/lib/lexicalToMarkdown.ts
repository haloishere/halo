import type { SerializedEditorState } from 'lexical'
import type { SanitizedConfig } from 'payload'
import { convertLexicalToMarkdown, editorConfigFactory } from '@payloadcms/richtext-lexical'

let cachedEditorConfig: Awaited<ReturnType<typeof editorConfigFactory.default>> | null = null

async function getEditorConfig(config: SanitizedConfig) {
  if (!cachedEditorConfig) {
    cachedEditorConfig = await editorConfigFactory.default({ config })
  }
  return cachedEditorConfig
}

export async function lexicalToMarkdown(
  data: SerializedEditorState,
  config: SanitizedConfig,
): Promise<string> {
  const editorConfig = await getEditorConfig(config)
  return convertLexicalToMarkdown({ data, editorConfig })
}
