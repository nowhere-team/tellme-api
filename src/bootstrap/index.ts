import { createServer, type Server } from '@/http'
import { type Cache, createCache } from '@/platform/cache'
import { type Config, createConfig } from '@/platform/config'
import { createDatabase, type Database } from '@/platform/database'
import { createLogger, type Logger } from '@/platform/logger'
import { createOpenRouter, type OpenRouterClient } from '@/platform/openrouter'
import { createRepositories, type Repositories } from '@/repositories'
import {
	createServices,
	InProcessStreamBus,
	RedisStreamBus,
	type Services,
	type StreamBus,
} from '@/services'

export interface App {
	config: Config
	logger: Logger
	database: Database
	cache: Cache
	repos: Repositories
	services: Services
	openrouter: OpenRouterClient | null
	server: Server
}

export async function start(options?: { useFakeAi?: boolean }): Promise<App> {
	const config = createConfig(process.env)
	const logger = createLogger({ level: config.LOG_LEVEL, format: config.LOG_FORMAT })

	const [database, cache] = await Promise.all([
		createDatabase(logger, { url: config.DATABASE_URL, maxConnections: config.DB_POOL_SIZE }),
		createCache({ url: config.REDIS_URL, keyPrefix: config.REDIS_PREFIX }),
	])

	const bus: StreamBus =
		config.STREAM_BUS === 'redis'
			? new RedisStreamBus(config.REDIS_URL, config.REDIS_PREFIX, logger)
			: new InProcessStreamBus()
	await bus.connect()

	const useFakeAi = options?.useFakeAi ?? false
	const openrouter = useFakeAi
		? null
		: createOpenRouter(
				{
					apiKey: config.OPENROUTER_API_KEY,
					baseUrl: config.OPENROUTER_BASE_URL,
					model: config.OPENROUTER_MODEL,
				},
				logger,
			)

	const repos = createRepositories(database)
	const services = createServices({
		repos,
		cache,
		logger,
		bus,
		auth: {
			jwt: { secret: config.JWT_SECRET, ttl: config.ACCESS_TOKEN_TTL },
			sessionTtl: config.SESSION_TTL,
		},
		openrouter: openrouter ?? undefined,
		useFakeAi,
	})

	const server = createServer({
		database,
		cache,
		services,
		logger,
		host: config.HOST,
		port: config.PORT,
		jwtSecret: config.JWT_SECRET,
		accessTtl: config.ACCESS_TOKEN_TTL,
	})

	return { config, logger, database, cache, repos, services, openrouter, server }
}

export async function stop(app: App) {
	app.logger.info('stopping')
	await app.server.stop()
	await app.services.bus.disconnect()
	await Promise.all([app.cache.disconnect(), app.database.disconnect()])
	app.logger.info('stopped')
}
