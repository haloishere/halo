import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from './schema/index.js'

export type DrizzleDb = PostgresJsDatabase<typeof schema>
