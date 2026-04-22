import { createAnonymousSession, load, isExpiring } from './session.ts'
import { chat, type ChatResult } from './client.ts'

const USAGE = `usage:
  mindtrip bootstrap          create anonymous session → .session.json
  mindtrip status             show current session expiry
  mindtrip chat "<query>" [--json]
                              ask mindtrip AI and show travel recommendations
`

function priceBand(level: number | null): string {
  if (level === null) return ''
  return '$'.repeat(Math.min(Math.max(level, 1), 4))
}

function renderResult(query: string, r: ChatResult): string {
  const lines: string[] = []
  lines.push(`Query: ${query}`)
  lines.push(`Chat ID: ${r.chatId}`)
  lines.push('')
  lines.push(r.body)

  if (r.places.length > 0) {
    lines.push('')
    lines.push('── Places ──────────────────────────────────────')
    r.places.forEach((p, i) => {
      const price = priceBand(p.priceLevel)
      const rating = p.userRating ? `★${p.userRating}` : ''
      const reviews = p.totalUserReviews ? `(${p.totalUserReviews} reviews)` : ''
      const michelin = p.isMichelin ? ' ✦ Michelin' : ''
      const label = [p.categoryLabel, ...p.cuisines]
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(', ')

      lines.push(
        `${i + 1}. ${p.name}${michelin}  ${price}  ${rating} ${reviews}`.trim(),
      )
      if (label) lines.push(`   ${label}`)
      if (p.formattedAddress) lines.push(`   ${p.formattedAddress}`)
      if (p.canonicalUrl) lines.push(`   ${p.canonicalUrl}`)
      if (p.bookingUrl && p.bookingUrl !== p.canonicalUrl) lines.push(`   Book: ${p.bookingUrl}`)
      if (p.photoUrl) lines.push(`   Photo: ${p.photoUrl}`)
      lines.push('')
    })
  }

  if (r.suggestedQuestions.length > 0) {
    lines.push('── Follow-ups ──────────────────────────────────')
    r.suggestedQuestions.forEach((q, i) => lines.push(`${i + 1}. ${q}`))
  }

  return lines.join('\n') + '\n'
}

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv

  switch (cmd) {
    case 'bootstrap': {
      process.stderr.write('[bootstrap] creating anonymous Mindtrip session…\n')
      const rec = await createAnonymousSession()
      process.stderr.write(
        `[bootstrap] ok — userId=${rec.userId} expires ${new Date(rec.expiresAt).toISOString()}\n`,
      )
      process.stdout.write(
        JSON.stringify({ userId: rec.userId, userRef: rec.userRef, expiresAt: rec.expiresAt }, null, 2) + '\n',
      )
      return
    }

    case 'status': {
      const cur = load()
      if (!cur) {
        process.stderr.write('[status] no .session.json — run `bootstrap` first\n')
        process.exit(1)
      }
      const secs = Math.round((cur.expiresAt - Date.now()) / 1000)
      process.stdout.write(
        JSON.stringify(
          {
            userId: cur.userId,
            userRef: cur.userRef,
            capturedAt: new Date(cur.capturedAt).toISOString(),
            expiresAt: new Date(cur.expiresAt).toISOString(),
            expiresInSec: secs,
            isExpiring: isExpiring(cur),
          },
          null,
          2,
        ) + '\n',
      )
      return
    }

    case 'chat': {
      const asJson = rest.includes('--json')
      const query = rest.filter((a) => a !== '--json').join(' ').trim()
      if (!query) throw new Error('usage: mindtrip chat "<query>" [--json]')

      process.stderr.write(`[chat] querying: ${query}\n`)
      const result = await chat(query)
      process.stderr.write(`[chat] got ${result.places.length} place(s)\n`)

      if (asJson) {
        process.stdout.write(JSON.stringify({ query, ...result }, null, 2) + '\n')
      } else {
        process.stdout.write(renderResult(query, result))
      }
      return
    }

    case undefined:
    case 'help':
    case '--help':
    case '-h': {
      process.stdout.write(USAGE)
      return
    }

    default: {
      process.stderr.write(`unknown command: ${cmd}\n${USAGE}`)
      process.exit(1)
    }
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? (err.stack ?? err.message) : String(err)
  process.stderr.write(`[error] ${msg}\n`)
  process.exit(2)
})
