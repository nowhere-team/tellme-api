import type { Server as BunServer } from 'bun'
import { Hono } from 'hono'

import { authMiddleware } from '@/http/middleware/auth'
import { errorHandler } from '@/http/middleware/errors'
import {
	createAuthRoutes,
	createHealthRoutes,
	createStoryRoutes,
	createStreamRoutes,
	createUserStoryRoutes,
} from '@/http/routes'
import type { Cache } from '@/platform/cache'
import type { Database } from '@/platform/database'
import type { Logger } from '@/platform/logger'
import type { Services } from '@/services'

export interface ServerDeps {
	database: Database
	cache: Cache
	services: Services
	logger: Logger
	host: string
	port: number
	jwtSecret: string
	accessTtl: number
}

export interface Server {
	server: BunServer<any>
	stop: () => Promise<void>
}

function createRouter(deps: ServerDeps) {
	const app = new Hono()
	app.onError(errorHandler(deps.logger))

	const api = new Hono()
	api.use('*', authMiddleware(deps.jwtSecret, deps.services.sessions, true))

	api.route('/health', createHealthRoutes({ database: deps.database, cache: deps.cache }))
	api.route('/auth', createAuthRoutes(deps.services.auth, deps.accessTtl))
	api.route('/stories', createStoryRoutes(deps.services.stories))
	api.route('/users', createUserStoryRoutes(deps.services.stories))
	api.route('/stream', createStreamRoutes(deps.services.bus))

	app.route('/api/v1', api)
	return app
}

export function createServer(deps: ServerDeps): Server {
	const router = createRouter(deps)
	const server = Bun.serve({
		fetch: router.fetch,
		port: deps.port,
		hostname: deps.host,
		// SSE connections stay open indefinitely; disable the default idle timeout
		idleTimeout: 0,
	})
	deps.logger.info(`listening on ${deps.host}:${deps.port}`)
	return { server, stop: () => server.stop() }
}
