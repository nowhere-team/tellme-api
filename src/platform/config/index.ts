import { z } from 'zod'

// =============================================================================
// schema
// =============================================================================

const schema = z.object({
	// environment
	NODE_ENV: z.enum(['production', 'development']).default('production'),

	// server
	HOST: z.hostname().default('127.0.0.1'),
	PORT: z.coerce.number().min(1).max(65535).default(8080),

	// logging
	LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
	LOG_FORMAT: z.enum(['text', 'json']).default('text'),

	// database
	DATABASE_URL: z.url().nonempty(),
	DB_POOL_SIZE: z.coerce.number().min(1).default(50),

	// cache
	REDIS_URL: z.url().nonempty(),

	// auth
	JWT_SECRET: z.string().min(32),
	ACCESS_TOKEN_TTL: z.coerce.number().min(60).default(900), // 15 min
	SESSION_TTL: z.coerce.number().min(3600).default(604800), // 7 days
})

// =============================================================================
// config factory
// =============================================================================

export function createConfig(env: Record<string, any>) {
	const raw = schema.parse(env)

	return {
		...raw,
		isDev: () => raw.NODE_ENV !== 'production',
		isProd: () => raw.NODE_ENV === 'production',
	}
}

export type Config = ReturnType<typeof createConfig>
