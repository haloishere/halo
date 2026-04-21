#!/usr/bin/env node
// Regenerate apps/mobile/src/constants/cities.json from GeoNames cities5000.
// Source: https://download.geonames.org/export/dump/cities5000.zip (CC BY 4.0)
// Filtered to BE/DE/CH/FR/NL, sorted by population DESC, compact { n, c } tuples.

import { execFileSync } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const GEONAMES_URL = 'https://download.geonames.org/export/dump/cities5000.zip'
const TARGET_COUNTRIES = new Map([
  ['BE', 'Belgium'],
  ['DE', 'Germany'],
  ['CH', 'Switzerland'],
  ['FR', 'France'],
  ['NL', 'Netherlands'],
])

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT_PATH = path.resolve(HERE, '..', 'src', 'constants', 'cities.json')

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`)
  await pipeline(res.body, createWriteStream(dest))
}

async function main() {
  const workDir = path.join(tmpdir(), `halo-cities-${Date.now()}`)
  await mkdir(workDir, { recursive: true })
  try {
    const zipPath = path.join(workDir, 'cities5000.zip')

    console.log(`→ downloading ${GEONAMES_URL}`)
    await download(GEONAMES_URL, zipPath)

    console.log('→ unzipping')
    try {
      execFileSync('unzip', ['-o', zipPath, '-d', workDir], { stdio: 'inherit' })
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        throw new Error(
          '`unzip` not found on PATH — install it or run this in a container with unzip.',
        )
      }
      throw err
    }

    const tsvPath = path.join(workDir, 'cities5000.txt')
    const raw = await readFile(tsvPath, 'utf8')

    console.log('→ parsing + filtering')
    const rows = []
    for (const line of raw.split('\n')) {
      if (!line) continue
      // GeoNames schema (tab-separated):
      // 0:geonameid 1:name 2:asciiname 3:alternatenames 4:lat 5:lon
      // 6:feature_class 7:feature_code 8:country_code 9:cc2 10:admin1
      // 11:admin2 12:admin3 13:admin4 14:population 15:elevation ...
      const cols = line.split('\t')
      const name = cols[1]
      const countryCode = cols[8]
      const populationStr = cols[14]
      const country = TARGET_COUNTRIES.get(countryCode)
      if (!country) continue
      const population = Number.parseInt(populationStr, 10)
      if (!Number.isFinite(population)) continue
      rows.push({ n: name, c: country, p: population })
    }

    rows.sort((a, b) => b.p - a.p)
    const output = rows.map(({ n, c }) => ({ n, c }))

    console.log(`→ writing ${output.length} entries to ${OUT_PATH}`)
    await mkdir(path.dirname(OUT_PATH), { recursive: true })
    await writeFile(OUT_PATH, JSON.stringify(output) + '\n')
    console.log('✓ done')
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error('✗ build-cities failed:', err)
  process.exit(1)
})
