import { RedisClient } from 'bun'

import type { Cache, CacheOptions } from './types'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/

function dateReviver(_key: string, value: unknown): unknown {
	if (
		typeof value === 'string' &&
		value.length >= 20 &&
		value[4] === '-' &&
		ISO_DATE_RE.test(value)
	) {
		return new Date(value)
	}
	return value
}

export interface RedisCacheConfig {
	url: string
	keyPrefix?: string
	defaultTtl?: number
}

export class RedisCache implements Cache {
	private client: RedisClient
	private readonly url: string
	private readonly prefix: string
	private readonly defaultTtl: number

	constructor(config: RedisCacheConfig) {
		this.url = config.url
		this.client = new RedisClient(this.url)
		this.prefix = config.keyPrefix ?? 'cache:'
		this.defaultTtl = config.defaultTtl ?? 3600
	}

	private key(k: string, options?: CacheOptions): string {
		if (options?.usePrefix === false) return k
		return `${this.prefix}${k}`
	}

	async connect(): Promise<void> {
		await this.client.connect()
	}

	private async reconnect(): Promise<void> {
		try {
			this.client.close()
		} catch {}
		this.client = new RedisClient(this.url)
		await this.client.connect()
	}

	private async exec<T>(fn: (client: RedisClient) => Promise<T>): Promise<T> {
		try {
			return await fn(this.client)
		} catch (err) {
			const msg = err instanceof Error ? err.message : ''
			if (
				msg.includes('ECONNRESET') ||
				msg.includes('ECONNREFUSED') ||
				msg.includes('closed') ||
				msg.includes('ended') ||
				msg.includes('timeout')
			) {
				await this.reconnect()
				return fn(this.client)
			}
			throw err
		}
	}

	async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
		const data = await this.exec(c => c.get(this.key(key, options)))
		if (!data) return null
		return JSON.parse(data, dateReviver) as T
	}

	async set<T>(key: string, value: T, ttl?: number, options?: CacheOptions): Promise<void> {
		const data = JSON.stringify(value)
		const fullKey = this.key(key, options)
		await this.exec(async c => {
			await c.set(fullKey, data)
			await c.expire(fullKey, ttl ?? this.defaultTtl)
		})
	}

	async delete(key: string, options?: CacheOptions): Promise<void> {
		await this.exec(c => c.del(this.key(key, options)))
	}

	async deletePattern(pattern: string, options?: CacheOptions): Promise<void> {
		await this.exec(async c => {
			const keys = await c.send('KEYS', [this.key(pattern, options)])
			if (Array.isArray(keys) && keys.length > 0) {
				await c.send('DEL', keys as string[])
			}
		})
	}

	async exists(key: string, options?: CacheOptions): Promise<boolean> {
		return this.exec(c => c.exists(this.key(key, options)))
	}

	async getOrSet<T>(
		key: string,
		factory: () => Promise<T>,
		ttl?: number,
		options?: CacheOptions,
	): Promise<T> {
		const cached = await this.get<T>(key, options)
		if (cached !== null) return cached

		const value = await factory()
		await this.set(key, value, ttl, options)
		return value
	}

	async health(): Promise<void> {
		await this.exec(c => c.ping())
	}

	async disconnect(): Promise<void> {
		this.client.close()
	}
}
