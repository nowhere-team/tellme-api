import { eq, lt } from 'drizzle-orm'

import { type Connection, sessions } from '@/platform/database'

export type DbSession = typeof sessions.$inferSelect

export interface CreateSessionData {
	userId: string
	userAgent: string | null
	ipHash: string
	ipSalt: string
	ttlSeconds: number
}

export class SessionRepository {
	constructor(private readonly db: Connection) {}

	async create(data: CreateSessionData): Promise<DbSession> {
		const [row] = await this.db
			.insert(sessions)
			.values({
				userId: data.userId,
				userAgent: data.userAgent,
				ipHash: data.ipHash,
				ipSalt: data.ipSalt,
				expiresAt: new Date(Date.now() + data.ttlSeconds * 1000),
			})
			.returning()
		return row
	}

	async findById(id: string): Promise<DbSession | null> {
		const [row] = await this.db.select().from(sessions).where(eq(sessions.id, id)).limit(1)
		return row ?? null
	}

	async findAllByUserId(userId: string): Promise<DbSession[]> {
		return this.db.select().from(sessions).where(eq(sessions.userId, userId))
	}

	async delete(id: string): Promise<void> {
		await this.db.delete(sessions).where(eq(sessions.id, id))
	}

	async deleteAllByUserId(userId: string): Promise<void> {
		await this.db.delete(sessions).where(eq(sessions.userId, userId))
	}

	async deleteExpired(): Promise<number> {
		const rows = await this.db
			.delete(sessions)
			.where(lt(sessions.expiresAt, new Date()))
			.returning({ id: sessions.id })
		return rows.length
	}
}
