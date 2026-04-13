import { drizzle } from 'drizzle-orm/bun-sql'

import type { Logger } from '@/platform/logger'

import { DatabaseLogger } from './logger'
import * as schema from './schema'

interface DatabaseConfig {
	url: string
	maxConnections?: number
}

export interface Database extends ReturnType<typeof createDrizzle> {
	health(): Promise<void>
	disconnect(): Promise<void>
}

function createDrizzle(logger: Logger, config: DatabaseConfig) {
	return drizzle({
		schema,
		casing: 'snake_case',
		logger: new DatabaseLogger(logger.named('database')),
		connection: {
			url: config.url,
			max: config.maxConnections ?? 50,
			idleTimeout: 30,
			maxLifetime: 60 * 30,
			connectionTimeout: 15,
		},
	})
}

export async function createDatabase(logger: Logger, config: DatabaseConfig): Promise<Database> {
	const db = createDrizzle(logger, config)

	const health = async () => await db.$client`SELECT 1`
	await health()

	const disconnect = async () => await db.$client.close({ timeout: 15 * 1000 })

	return Object.assign(db, { health, disconnect })
}

export type Tx = Parameters<Database['transaction']>[0] extends (tx: infer T) => any ? T : never
export type Connection = Database | Tx

export * from './schema'
export { schema }
