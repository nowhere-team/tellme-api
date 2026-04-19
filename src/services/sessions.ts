import type { Cache } from '@/platform/cache'

const PREFIX = 'session:'

export class SessionsService {
	constructor(private readonly cache: Cache) {}

	async activate(sessionId: string, ttlSeconds: number): Promise<void> {
		await this.cache.set(`${PREFIX}${sessionId}`, '1', ttlSeconds, { usePrefix: false })
	}

	async isActive(sessionId: string): Promise<boolean> {
		return this.cache.exists(`${PREFIX}${sessionId}`, { usePrefix: false })
	}

	async revoke(sessionId: string): Promise<void> {
		await this.cache.delete(`${PREFIX}${sessionId}`, { usePrefix: false })
	}

	async revokeAllForUser(sessionIds: string[]): Promise<void> {
		await Promise.all(sessionIds.map(id => this.revoke(id)))
	}
}
