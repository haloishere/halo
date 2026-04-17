/**
 * Validate and parse composite cursor strings (isoDate|uuid).
 * Returns null if the cursor is malformed — callers should return 400.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseCursor(cursor: string): { date: Date; id: string } | null {
  const pipeIndex = cursor.indexOf('|')
  if (pipeIndex === -1) return null

  const dateStr = cursor.slice(0, pipeIndex)
  const id = cursor.slice(pipeIndex + 1)

  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return null
  if (!UUID_REGEX.test(id)) return null

  return { date, id }
}
