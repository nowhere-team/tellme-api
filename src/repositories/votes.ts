import { and, eq, inArray, sql } from 'drizzle-orm'

import { AppError } from '@/common/errors'
import { type Connection, voteOptions, votes } from '@/platform/database'

export type DbVote = typeof votes.$inferSelect

export class VoteRepository {
	constructor(private readonly db: Connection) {}

	async cast(storyId: string, userId: string, optionId: string): Promise<DbVote> {
		try {
			return await this.db.transaction(async tx => {
				const [option] = await tx
					.select({ id: voteOptions.id })
					.from(voteOptions)
					.where(and(eq(voteOptions.id, optionId), eq(voteOptions.storyId, storyId)))
					.limit(1)

				if (!option) throw AppError.validation('vote option does not belong to this story')

				const [vote] = await tx.insert(votes).values({ storyId, userId, optionId }).returning()

				await tx
					.update(voteOptions)
					.set({ voteCount: sql`${voteOptions.voteCount} + 1` })
					.where(eq(voteOptions.id, optionId))

				return vote
			})
		} catch (err) {
			if (isUniqueVoteViolation(err)) throw AppError.conflict('already voted')
			throw err
		}
	}

	async findUserVote(storyId: string, userId: string): Promise<DbVote | null> {
		const [row] = await this.db
			.select()
			.from(votes)
			.where(and(eq(votes.storyId, storyId), eq(votes.userId, userId)))
			.limit(1)
		return row ?? null
	}

	async findUserVotesForStories(userId: string, storyIds: string[]): Promise<DbVote[]> {
		if (storyIds.length === 0) return []
		return this.db
			.select()
			.from(votes)
			.where(and(eq(votes.userId, userId), inArray(votes.storyId, storyIds)))
	}

	async getOptions(storyId: string): Promise<(typeof voteOptions.$inferSelect)[]> {
		return this.db
			.select()
			.from(voteOptions)
			.where(eq(voteOptions.storyId, storyId))
			.orderBy(voteOptions.position)
	}
}

function isUniqueVoteViolation(err: unknown): boolean {
	if (!(err instanceof Error)) return false
	const msg = err.message
	return msg.includes('votes_story_user_uq') || msg.includes('duplicate key')
}
