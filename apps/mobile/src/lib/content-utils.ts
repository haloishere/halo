import type { ContentCategory } from '@halo/shared'

const CATEGORY_LABELS: Record<ContentCategory, string> = {
  understanding_disease: 'Understanding the Disease',
  daily_care: 'Daily Care',
  behavioral_management: 'Behavioral Management',
  communication: 'Communication',
  safety: 'Safety',
  self_care: 'Self Care',
  legal_financial: 'Legal & Financial',
}

export function getCategoryLabel(category: ContentCategory): string {
  return CATEGORY_LABELS[category] ?? category
}

export function getSnippet(body: string, maxLength: number = 200): string {
  const stripped = body
    .replace(/^#{1,6}\s+/gmu, '') // headings
    .replace(/\*{1,2}([^*]+)\*{1,2}/gu, '$1') // bold/italic
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1') // links
    .replace(/`([^`]+)`/gu, '$1') // inline code
    .replace(/\n+/gu, ' ') // newlines to spaces
    .replace(/\s+/gu, ' ') // collapse whitespace
    .trim()

  if (stripped.length <= maxLength) return stripped
  return stripped.slice(0, maxLength) + '...'
}

export function formatReadTime(body: string): string {
  const wordCount = body.split(/\s+/u).filter(Boolean).length
  const minutes = Math.max(1, Math.round(wordCount / 200))
  return `${minutes} min read`
}
