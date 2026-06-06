import { buildDisplayId, DICTIONARY, type Language } from '@nowhere-team/tellme-sdk'
import { eq, inArray, isNotNull, like } from 'drizzle-orm'

import { AppError } from '@/common/errors'
import { type Connection, users } from '@/platform/database'

export type DbUser = typeof users.$inferSelect

export interface CreateUserData {
	passwordHash: string
	totpSecret: string | null
	recoveryHash: string
	locale?: Language
	botPersona?: string | null
}

const MAX_ATTEMPTS = 5

export class UserRepository {
	constructor(private readonly db: Connection) {}

	async create(data: CreateUserData): Promise<DbUser> {
		const adjCount = DICTIONARY.ru.adjectives.length
		const nounCount = DICTIONARY.ru.nouns.length

		for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
			const aIdx = Math.floor(Math.random() * adjCount)
			const nIdx = Math.floor(Math.random() * nounCount)
			const disc = await this.nextDiscriminator(aIdx, nIdx)
			const username = buildDisplayId(aIdx, nIdx, disc)

			const [user] = await this.db
				.insert(users)
				.values({
					username,
					passwordHash: data.passwordHash,
					totpSecret: data.totpSecret,
					recoveryHash: data.recoveryHash,
					botPersona: data.botPersona ?? null,
					locale: data.locale ?? 'ru',
				})
				.onConflictDoNothing({ target: users.username })
				.returning()

			if (user) return user
		}
		throw AppError.conflict('failed to allocate username')
	}

	async findBots(): Promise<DbUser[]> {
		return this.db.select().from(users).where(isNotNull(users.botPersona))
	}

	async findById(id: string): Promise<DbUser | null> {
		const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1)
		return row ?? null
	}

	async findByUsername(username: string): Promise<DbUser | null> {
		const [row] = await this.db.select().from(users).where(eq(users.username, username)).limit(1)
		return row ?? null
	}

	async findByRecoveryHash(hash: string): Promise<DbUser | null> {
		const [row] = await this.db.select().from(users).where(eq(users.recoveryHash, hash)).limit(1)
		return row ?? null
	}

	async setBanned(id: string, banned: boolean): Promise<void> {
		await this.db
			.update(users)
			.set({ bannedAt: banned ? new Date() : null })
			.where(eq(users.id, id))
	}

	async setTotpSecret(id: string, secret: string | null): Promise<void> {
		await this.db.update(users).set({ totpSecret: secret }).where(eq(users.id, id))
	}

	async setPasswordHash(id: string, hash: string): Promise<void> {
		await this.db.update(users).set({ passwordHash: hash }).where(eq(users.id, id))
	}

	private async nextDiscriminator(aIdx: number, nIdx: number): Promise<number> {
		const prefix = `${aIdx}:${nIdx}:`
		const rows = await this.db
			.select({ username: users.username })
			.from(users)
			.where(like(users.username, `${prefix}%`))

		const max = rows.reduce((m, r) => {
			const d = parseInt(r.username.split(':')[2] ?? '-1', 10)
			return Number.isNaN(d) ? m : Math.max(m, d)
		}, -1)

		return max + 1
	}

	async findManyByIds(ids: string[]): Promise<DbUser[]> {
		if (ids.length === 0) return []
		return this.db.select().from(users).where(inArray(users.id, ids))
	}
}
