export interface CacheOptions {
	usePrefix?: boolean // default: true
}

export interface Cache {
	get<T>(key: string, options?: CacheOptions): Promise<T | null>
	set<T>(key: string, value: T, ttl?: number, options?: CacheOptions): Promise<void>
	delete(key: string, options?: CacheOptions): Promise<void>
	deletePattern(pattern: string, options?: CacheOptions): Promise<void>
	exists(key: string, options?: CacheOptions): Promise<boolean>

	// helpers
	getOrSet<T>(
		key: string,
		factory: () => Promise<T>,
		ttl?: number,
		options?: CacheOptions,
	): Promise<T>

	connect(): Promise<void>
	health(): Promise<void>
	disconnect(): Promise<void>
}
