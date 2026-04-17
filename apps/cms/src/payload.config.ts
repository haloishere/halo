import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { gcsStorage } from '@payloadcms/storage-gcs'
import sharp from 'sharp'
import { Articles } from './collections/Articles'
import { Media } from './collections/Media'
import { Users } from './collections/Users'
import { migrations } from './migrations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const isProduction = process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test'

const plugins = process.env.GCS_BUCKET
  ? [
      gcsStorage({
        collections: {
          'cms-media': {
            prefix: 'cms',
          },
        },
        bucket: process.env.GCS_BUCKET,
        options: {
          projectId: process.env.GOOGLE_CLOUD_PROJECT,
        },
      }),
    ]
  : []

export default buildConfig({
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || '',
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Articles, Media, Users],
  db: postgresAdapter({
    schemaName: 'cms',
    // Auto-run migrations on startup in non-dev environments
    prodMigrations: migrations,
    pool: {
      // Strip sslmode from URL — pg driver's sslmode=require sets rejectUnauthorized:true
      // which fails with Cloud SQL's managed cert. We handle SSL explicitly below.
      connectionString: (process.env.DATABASE_URL ?? '').replace(/[?&]sslmode=[^&]*/u, ''),
      max: isProduction ? 5 : 2,
      ssl: isProduction
        ? {
            rejectUnauthorized: true,
            ca: process.env.DB_SERVER_CA_CERT,
            // Cloud SQL cert CN is *.sql.goog, but we connect via private IP.
            // Verify the CA chain but skip hostname matching.
            checkServerIdentity: () => undefined,
          }
        : false,
    },
  }),
  editor: lexicalEditor(),
  plugins,
  secret: (() => {
    const s = process.env.PAYLOAD_SECRET
    if (!s) throw new Error('PAYLOAD_SECRET environment variable is required')
    return s
  })(),
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
