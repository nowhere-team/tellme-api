import type { Server as BunServer } from 'bun'
import { Hono } from 'hono'

import { createHealthRoutes } from '@/http/routes'
import type { Cache } from '@/platform/cache'
import type { Database } from '@/platform/database'
import type { Logger } from '@/platform/logger'

export interface ServerDeps {
	database: Database
	cache: Cache
	logger: Logger
	host: string
	port: number
}

export interface Server {
	server: BunServer<any>
	stop: () => Promise<void>
}

function createRouter({ database, cache, logger }: ServerDeps) {
	const app = new Hono()
	app.route('/health', createHealthRoutes({ database, cache }))
	return app
}

export function createServer(deps: ServerDeps): Server {
	const router = createRouter(deps)

	const server = Bun.serve({
		fetch: router.fetch,
		port: deps.port,
		hostname: deps.host,
	})

	deps.logger.info(`listening on ${deps.host}:${deps.port}`)

	return {
		server,
		stop: () => server.stop(),
	}
}
