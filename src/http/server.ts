import type { Server as BunServer } from 'bun'
import { Hono } from 'hono'

import { authMiddleware } from '@/http/middleware/auth'
import { errorHandler } from '@/http/middleware/errors'
import {
	createAuthRoutes,
	createCommentRoutes,
	createHealthRoutes,
	createStoryRoutes,
	createStreamRoutes,
	createUserRoutes,
	createUserStoryRoutes,
} from '@/http/routes'
import type { Cache } from '@/platform/cache'
import type { Database } from '@/platform/database'
import type { Logger } from '@/platform/logger'
import type { Repositories } from '@/repositories'
import type { Services } from '@/services'

export interface ServerDeps {
	database: Database
	cache: Cache
	repos: Repositories
	services: Services
	logger: Logger
	host: string
	port: number
	jwtSecret: string
	accessTtl: number
	captchaEnabled: boolean
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
	api.route('/auth', createAuthRoutes(deps.services.auth, deps.accessTtl, deps.jwtSecret))
	api.route('/stories', createStoryRoutes(deps.services.stories))
	api.route('/stories', createCommentRoutes(deps.services.comments))
	api.route('/users', createUserRoutes(deps.repos))
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
		idleTimeout: 0,
	})
	deps.logger.info(`listening on ${deps.host}:${deps.port}`)
	return { server, stop: () => server.stop() }
}
