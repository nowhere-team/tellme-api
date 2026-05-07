import { and, count, eq, inArray } from 'drizzle-orm'

import type { Connection } from '@/platform/database'
import { comments } from '@/platform/database'

export type DbComment = typeof comments.$inferSelect

export interface CreateCommentData {
	storyId: string
	authorId: string
	parentId: string | null
	content: string
}

export class CommentRepository {
	constructor(private readonly db: Connection) {}

	async create(data: CreateCommentData): Promise<DbComment> {
		const [row] = await this.db
			.insert(comments)
			.values({
				storyId: data.storyId,
				authorId: data.authorId,
				parentId: data.parentId,
				content: data.content,
				status: 'published',
			})
			.returning()
		return row
	}

	async findById(id: string): Promise<DbComment | null> {
		const [row] = await this.db.select().from(comments).where(eq(comments.id, id)).limit(1)
		return row ?? null
	}

	async findByStory(storyId: string): Promise<DbComment[]> {
		return this.db
			.select()
			.from(comments)
			.where(and(eq(comments.storyId, storyId), eq(comments.status, 'published')))
			.orderBy(comments.createdAt)
	}

	async countForStories(storyIds: string[]): Promise<Map<string, number>> {
		if (storyIds.length === 0) return new Map()
		const rows = await this.db
			.select({ storyId: comments.storyId, count: count() })
			.from(comments)
			.where(and(inArray(comments.storyId, storyIds), eq(comments.status, 'published')))
			.groupBy(comments.storyId)
		return new Map(rows.map(r => [r.storyId, Number(r.count)]))
	}

	async hide(commentId: string): Promise<void> {
		await this.db.update(comments).set({ status: 'rejected' }).where(eq(comments.id, commentId))
	}
}
