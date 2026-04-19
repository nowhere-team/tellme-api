// noinspection ES6PreferShortImport

import { resolve } from 'node:path'

import type { App } from '../../../src/bootstrap'
import {
	comments,
	reports,
	sessions,
	stories,
	users,
	voteOptions,
	votes,
} from '../../../src/platform/database'
import { TellMeClient } from '../src'
import { startContainers, type TestContainers } from './containers'

const PROJECT_ROOT = resolve(import.meta.dirname, '../../..')
const MIGRATIONS_FOLDER = resolve(PROJECT_ROOT, 'migrations')

export interface TestContext {
	app: App
	baseUrl: string
	containers: TestContainers
	createClient: () => TellMeClient
	createAuthenticatedClient: () => Promise<AuthenticatedClient>
	cleanup: () => Promise<void>
}

export interface AuthenticatedClient {
	client: TellMeClient
	userId: string
	username: string
	accessToken: string
}

let globalContext: TestContext | null = null

export async function getTestContext(): Promise<TestContext> {
	if (globalContext) return globalContext

	const containers = await startContainers()
	await runMigrations(containers.postgresUrl)

	const port = 10000 + Math.floor(Math.random() * 50000)

	process.env.NODE_ENV = 'development'
	process.env.HOST = '127.0.0.1'
	process.env.PORT = String(port)
	process.env.LOG_LEVEL = 'error'
	process.env.LOG_FORMAT = 'text'
	process.env.DATABASE_URL = containers.postgresUrl
	process.env.REDIS_URL = containers.redisUrl
	process.env.REDIS_PREFIX = 'tellme-test:'
	process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters'
	process.env.ACCESS_TOKEN_TTL = '900'
	process.env.SESSION_TTL = '604800'
	process.env.OPENROUTER_API_KEY = 'test-key'
	process.env.OPENROUTER_MODEL = 'google/gemini-2.5-flash'

	const { start } = await import('../../../src/bootstrap')
	const app = await start({ useFakeAi: true })

	const baseUrl = `http://127.0.0.1:${port}`

	const createClient = () => new TellMeClient({ baseUrl, credentials: 'omit' })

	const createAuthenticatedClient = async (): Promise<AuthenticatedClient> => {
		const bare = createClient()
		const res = await bare.auth.register({ password: 'testpassword123' })
		const client = new TellMeClient({
			baseUrl,
			getToken: () => res.accessToken,
			credentials: 'omit',
		})
		return {
			client,
			userId: res.user.id,
			username: res.user.username,
			accessToken: res.accessToken,
		}
	}

	const cleanup = async () => {
		const { stop } = await import('../../../src/bootstrap')
		await stop(app)
		await containers.stop()
		globalContext = null
	}

	globalContext = {
		app,
		baseUrl,
		containers,
		createClient,
		createAuthenticatedClient,
		cleanup,
	}
	return globalContext
}

async function runMigrations(databaseUrl: string) {
	const { drizzle } = await import('drizzle-orm/bun-sql')
	const { migrate } = await import('drizzle-orm/bun-sql/migrator')
	const db = drizzle({ connection: databaseUrl })
	await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
	await db.$client.close()
}

export async function cleanDatabase(app: App) {
	await app.database.delete(votes)
	await app.database.delete(voteOptions)
	await app.database.delete(reports)
	await app.database.delete(comments)
	await app.database.delete(stories)
	await app.database.delete(sessions)
	await app.database.delete(users)
}
