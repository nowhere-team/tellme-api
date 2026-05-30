import { z } from 'zod'

const schema = z.object({
	NODE_ENV: z.enum(['production', 'development']).default('production'),

	HOST: z.hostname().default('127.0.0.1'),
	PORT: z.coerce.number().min(1).max(65535).default(8080),

	LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
	LOG_FORMAT: z.enum(['text', 'json']).default('text'),

	DATABASE_URL: z.url().nonempty(),
	DB_POOL_SIZE: z.coerce.number().min(1).default(50),

	REDIS_URL: z.url().nonempty(),
	REDIS_PREFIX: z.string().default('tellme:'),

	JWT_SECRET: z.string().min(32),
	ACCESS_TOKEN_TTL: z.coerce.number().min(60).default(900),
	SESSION_TTL: z.coerce.number().min(3600).default(604800),

	OPENROUTER_API_KEY: z.string().min(1),
	OPENROUTER_BASE_URL: z.url().optional(),
	OPENROUTER_MODEL: z.string().default('google/gemini-3-flash-preview'),

	STREAM_BUS: z.enum(['memory', 'redis']).default('memory'),

	// ALTCHA captcha on registration; set to "false" to disable (tests)
	CAPTCHA_ENABLED: z
		.enum(['true', 'false'])
		.default('true')
		.transform(v => v === 'true'),
})

export function createConfig(env: Record<string, any>) {
	const raw = schema.parse(env)
	return {
		...raw,
		isDev: () => raw.NODE_ENV !== 'production',
		isProd: () => raw.NODE_ENV === 'production',
	}
}

export type Config = ReturnType<typeof createConfig>
