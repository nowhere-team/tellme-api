import { createServer, type Server } from '@/http'
import { type Cache, createCache } from '@/platform/cache'
import { type Config, createConfig } from '@/platform/config'
import { createDatabase, type Database } from '@/platform/database'
import { createLogger, type Logger } from '@/platform/logger'

export interface App {
	config: Config
	logger: Logger
	database: Database
	cache: Cache
	server: Server
}

export async function start(): Promise<App> {
	const config = createConfig(process.env)
	const logger = createLogger({ level: config.LOG_LEVEL, format: config.LOG_FORMAT })
	const [database, cache] = await Promise.all([
		createDatabase(logger, { url: config.DATABASE_URL, maxConnections: config.DB_POOL_SIZE }),
		createCache({ url: config.REDIS_URL }),
	])

	const server = createServer({
		database,
		cache,
		logger,
		host: config.HOST,
		port: config.PORT,
	})

	return { config, logger, database, cache, server }
}

export async function stop(app: App) {
	app.logger.info('stopping')

	await app.server.stop()
	await Promise.all([app.cache.disconnect(), app.database.disconnect()])

	app.logger.info('stopped')
}
