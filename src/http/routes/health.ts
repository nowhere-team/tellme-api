import { Hono } from 'hono'

import type { Cache } from '@/platform/cache'
import type { Database } from '@/platform/database'

interface HealthDeps {
	database: Database
	cache: Cache
}

export function createHealthRoutes({ database, cache }: HealthDeps) {
	const app = new Hono()

	app.get('/', c => c.json({ status: 'ok' }))
	app.get('/live', c => c.json({ status: 'ok' }))

	app.get('/ready', async c => {
		const checks = await Promise.all([
			check('database', () => database.health()),
			check('cache', () => cache.health()),
		])

		const healthy = checks.every(c => c.status === 'ok')

		return c.json(
			{
				status: healthy ? 'ok' : 'degraded',
				checks: Object.fromEntries(checks.map(c => [c.name, c.status])),
			},
			healthy ? 200 : 503,
		)
	})

	return app
}

async function check(name: string, fn: () => Promise<void>) {
	const start = performance.now()
	try {
		await fn()
		return { name, status: 'ok' as const, latency: performance.now() - start }
	} catch (err) {
		return { name, status: 'fail' as const, error: err instanceof Error ? err.message : 'unknown' }
	}
}
