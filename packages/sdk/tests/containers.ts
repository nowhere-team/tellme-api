import { connect } from 'node:net'
import { $ } from 'bun'

export interface TestContainers {
	postgresUrl: string
	redisUrl: string
	stop: () => Promise<void>
}

const POSTGRES_PORT = process.env.TEST_POSTGRES_PORT ?? '5439'
const REDIS_PORT = process.env.TEST_REDIS_PORT ?? '6389'

async function isPortReachable(port: string): Promise<boolean> {
	return new Promise(resolve => {
		const socket = connect(Number(port), 'localhost')
		socket.on('connect', () => {
			socket.destroy()
			resolve(true)
		})
		socket.on('error', () => resolve(false))
		socket.setTimeout(1000, () => {
			socket.destroy()
			resolve(false)
		})
	})
}

async function waitForHealthy(name: string, timeoutMs = 30000): Promise<void> {
	const start = Date.now()
	while (Date.now() - start < timeoutMs) {
		try {
			const result = await $`docker inspect --format='{{.State.Health.Status}}' ${name}`.text()
			if (result.trim() === 'healthy') return
		} catch {}
		await Bun.sleep(500)
	}
	throw new Error(`container ${name} did not become healthy within ${timeoutMs}ms`)
}

export async function startContainers(): Promise<TestContainers> {
	const postgresUrl = `postgresql://test:test@localhost:${POSTGRES_PORT}/tellme_test`
	const redisUrl = `redis://localhost:${REDIS_PORT}`

	const postgresReachable = await isPortReachable(POSTGRES_PORT)
	const redisReachable = await isPortReachable(REDIS_PORT)

	if (postgresReachable && redisReachable) {
		return { postgresUrl, redisUrl, stop: async () => {} }
	}

	await $`docker compose -f docker-compose.test.yml up -d --wait`.quiet()
	await Promise.all([waitForHealthy('tellme-postgres-test'), waitForHealthy('tellme-redis-test')])

	return {
		postgresUrl,
		redisUrl,
		stop: async () => {
			await $`docker compose -f docker-compose.test.yml down -v`.quiet()
		},
	}
}
