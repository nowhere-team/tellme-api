import { RedisCache } from './redis'
import type { Cache } from './types'

export interface CacheConfig {
	url: string
	keyPrefix?: string
	defaultTtl?: number
}

export async function createCache(config: CacheConfig): Promise<Cache> {
	const cache = new RedisCache(config)
	await cache.connect()
	return cache
}

export * from './types'
