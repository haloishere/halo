import type { CommunityCircle } from '@halo/shared'

const CIRCLE_LABELS: Record<CommunityCircle, string> = {
  'emotional-support': 'Emotional Support',
  'daily-care-tips': 'Daily Care Tips',
  'caregiver-stories': 'Caregiver Stories',
  'medical-questions': 'Medical Questions',
  'activities-engagement': 'Activities & Engagement',
  'legal-financial': 'Legal & Financial',
  'resources-recommendations': 'Resources',
  'humor-light-moments': 'Humor & Light',
}

export function getCircleLabel(slug: CommunityCircle): string {
  return CIRCLE_LABELS[slug] ?? slug
}

export function truncateBody(body: string, maxLength = 150): string {
  if (body.length <= maxLength) return body
  return body.slice(0, maxLength).trimEnd() + '...'
}

export function getRelativeTime(isoDate: string): string {
  const now = Date.now()
  const then = new Date(isoDate).getTime()
  const diffMs = now - then

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`

  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w`

  const months = Math.floor(days / 30)
  return `${months}mo`
}
