import { textSearch, nearbySearch, placeDetails, type Place } from './client.ts'

const USAGE = `usage:
  places search "<query>" [--lat <lat> --lng <lng>] [--radius <m>] [--max <n>] [--json]
  places nearby --lat <lat> --lng <lng> [--radius <m>] [--type <type>] [--max <n>] [--json]
  places details <placeId> [--json]

env:
  GOOGLE_PLACES_API_KEY   required
`

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i !== -1 ? args[i + 1] : undefined
}

function priceBand(level?: string): string {
  const map: Record<string, string> = {
    PRICE_LEVEL_FREE: 'Free',
    PRICE_LEVEL_INEXPENSIVE: '$',
    PRICE_LEVEL_MODERATE: '$$',
    PRICE_LEVEL_EXPENSIVE: '$$$',
    PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
  }
  return level ? (map[level] ?? level) : '—'
}

function renderPlace(p: Place, index?: number): string {
  const prefix = index !== undefined ? `${index + 1}. ` : ''
  const rating = p.rating !== undefined ? `★ ${p.rating.toFixed(1)}` : ''
  const reviews = p.userRatingCount !== undefined ? ` (${p.userRatingCount})` : ''
  const price = priceBand(p.priceLevel)
  const open = p.currentOpeningHours?.openNow !== undefined
    ? p.currentOpeningHours.openNow ? '  Open now' : '  Closed'
    : ''
  const type = p.primaryTypeDisplayName ? `  [${p.primaryTypeDisplayName}]` : ''

  const lines: string[] = [
    `${prefix}${p.displayName}${type}`,
    p.formattedAddress ? `   ${p.formattedAddress}` : '',
    [rating ? `   ${rating}${reviews}` : '', price !== '—' ? `  ${price}` : '', open].filter(Boolean).join(''),
    p.editorialSummary ? `   "${p.editorialSummary}"` : '',
    p.websiteUri ? `   ${p.websiteUri}` : '',
    p.nationalPhoneNumber ? `   ${p.nationalPhoneNumber}` : '',
  ]
  return lines.filter(Boolean).join('\n')
}

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv

  switch (cmd) {
    case 'search': {
      const asJson = rest.includes('--json')
      const lat = flag(rest, '--lat')
      const lng = flag(rest, '--lng')
      const radius = flag(rest, '--radius')
      const max = flag(rest, '--max')
      const query = rest
        .filter((a) => !a.startsWith('--') && a !== lat && a !== lng && a !== radius && a !== max)
        .join(' ')
        .trim()

      if (!query) throw new Error('usage: places search "<query>"')

      const places = await textSearch(query, {
        locationBias:
          lat && lng
            ? {
                circle: {
                  center: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
                  radius: radius ? parseFloat(radius) : 5000,
                },
              }
            : undefined,
        maxResultCount: max ? parseInt(max, 10) : undefined,
      })

      if (asJson) {
        process.stdout.write(JSON.stringify({ query, count: places.length, places }, null, 2) + '\n')
      } else {
        process.stdout.write(`Search: ${query}\n${places.length} result(s)\n\n`)
        places.forEach((p, i) => process.stdout.write(renderPlace(p, i) + '\n\n'))
      }
      return
    }

    case 'nearby': {
      const asJson = rest.includes('--json')
      const lat = flag(rest, '--lat')
      const lng = flag(rest, '--lng')
      const radius = flag(rest, '--radius') ?? '1000'
      const type = flag(rest, '--type')
      const max = flag(rest, '--max')

      if (!lat || !lng) throw new Error('usage: places nearby --lat <lat> --lng <lng>')

      const places = await nearbySearch(
        { latitude: parseFloat(lat), longitude: parseFloat(lng) },
        parseFloat(radius),
        {
          includedTypes: type ? [type] : undefined,
          maxResultCount: max ? parseInt(max, 10) : undefined,
        },
      )

      if (asJson) {
        process.stdout.write(
          JSON.stringify({ lat, lng, radius, type, count: places.length, places }, null, 2) + '\n',
        )
      } else {
        process.stdout.write(
          `Nearby (${lat}, ${lng}) within ${radius}m${type ? ` — ${type}` : ''}\n${places.length} result(s)\n\n`,
        )
        places.forEach((p, i) => process.stdout.write(renderPlace(p, i) + '\n\n'))
      }
      return
    }

    case 'details': {
      const asJson = rest.includes('--json')
      const id = rest.find((a) => !a.startsWith('--'))
      if (!id) throw new Error('usage: places details <placeId>')

      const place = await placeDetails(id)

      if (asJson) {
        process.stdout.write(JSON.stringify(place, null, 2) + '\n')
      } else {
        process.stdout.write(renderPlace(place) + '\n')
        if (place.regularOpeningHours?.weekdayDescriptions?.length) {
          process.stdout.write('\nHours:\n')
          place.regularOpeningHours.weekdayDescriptions.forEach((d) =>
            process.stdout.write(`  ${d}\n`),
          )
        }
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
