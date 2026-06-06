import type { Category, Rejection, Warning } from '@nowhere-team/tellme-sdk'
import { and, desc, eq, getTableColumns, inArray, lt, or, sql } from 'drizzle-orm'

import { type Connection, stories, voteOptions } from '@/platform/database'

import { decodeCursor, decodeFeedCursor, encodeCursor, encodeFeedCursor } from './_cursor'

export type DbStory = typeof stories.$inferSelect
export type DbVoteOption = typeof voteOptions.$inferSelect

export interface StoryWithOptions extends DbStory {
	options: DbVoteOption[]
}

export interface CreateProcessingData {
	authorId: string
	raw: string
	visibility: 'open' | 'anonymous'
	locale: 'ru' | 'en'
}

export interface AcceptedData {
	headline: string
	title: string
	preview: string
	text: string
	replacements: Record<string, string>
	category: Category
	warnings: Warning[]
	options: Array<{ label: string; position: number }>
}

export interface RejectedData {
	code: Rejection
	message: string
}

export interface FeedQuery {
	category?: string
	limit?: number
	cursor?: string
	sort?: 'hot' | 'new'
}

export interface AuthorQuery {
	limit?: number
	cursor?: string
}

export interface PaginatedStories {
	items: DbStory[]
	nextCursor: string | null
}

export class StoryRepository {
	constructor(private readonly db: Connection) {}

	async createProcessing(data: CreateProcessingData): Promise<DbStory> {
		const [row] = await this.db
			.insert(stories)
			.values({
				authorId: data.authorId,
				raw: data.raw,
				visibility: data.visibility,
				locale: data.locale,
				status: 'processing',
			})
			.returning()
		return row
	}

	async applyAccepted(storyId: string, data: AcceptedData): Promise<StoryWithOptions> {
		return this.db.transaction(async tx => {
			const [story] = await tx
				.update(stories)
				.set({
					status: 'ready',
					headline: data.headline,
					title: data.title,
					preview: data.preview,
					text: data.text,
					replacements: data.replacements,
					category: data.category,
					warnings: data.warnings,
					rejectionCode: null,
					rejectionMessage: null,
					updatedAt: new Date(),
				})
				.where(eq(stories.id, storyId))
				.returning()

			await tx.delete(voteOptions).where(eq(voteOptions.storyId, storyId))
			const options = await tx
				.insert(voteOptions)
				.values(data.options.map(o => ({ storyId, label: o.label, position: o.position })))
				.returning()

			return { ...story, options }
		})
	}

	async applyRejected(storyId: string, data: RejectedData): Promise<DbStory | null> {
		const [row] = await this.db
			.update(stories)
			.set({
				status: 'rejected',
				rejectionCode: data.code,
				rejectionMessage: data.message,
				updatedAt: new Date(),
			})
			.where(eq(stories.id, storyId))
			.returning()
		return row ?? null
	}

	async publish(storyId: string): Promise<DbStory | null> {
		const now = new Date()
		const [row] = await this.db
			.update(stories)
			.set({ status: 'published', raw: null, publishedAt: now, updatedAt: now })
			.where(and(eq(stories.id, storyId), eq(stories.status, 'ready')))
			.returning()
		return row ?? null
	}

	async hide(storyId: string): Promise<void> {
		await this.db
			.update(stories)
			.set({ status: 'hidden', updatedAt: new Date() })
			.where(eq(stories.id, storyId))
	}

	async restore(storyId: string): Promise<void> {
		await this.db
			.update(stories)
			.set({ status: 'published', updatedAt: new Date() })
			.where(eq(stories.id, storyId))
	}

	async findById(id: string): Promise<DbStory | null> {
		const [row] = await this.db.select().from(stories).where(eq(stories.id, id)).limit(1)
		return row ?? null
	}

	async findByIdWithOptions(id: string): Promise<StoryWithOptions | null> {
		const [story] = await this.db.select().from(stories).where(eq(stories.id, id)).limit(1)
		if (!story) return null

		const options = await this.db
			.select()
			.from(voteOptions)
			.where(eq(voteOptions.storyId, id))
			.orderBy(voteOptions.position)

		return { ...story, options }
	}

	async findFeed(query: FeedQuery = {}): Promise<PaginatedStories> {
		const limit = query.limit ?? 20
		const sort = query.sort ?? 'hot'
		const conditions = [eq(stories.status, 'published')]

		if (query.category) conditions.push(eq(stories.category, query.category))

		// time-decayed "hot" score; reused for ordering and for the cursor key
		const score = sql<number>`(${stories.totalVoteCount}::float / power(extract(epoch from now() - ${stories.publishedAt}) / 3600 + 2, 1.5))`

		if (query.cursor) {
			const c = decodeFeedCursor(query.cursor)
			// ignore a cursor produced for a different sort
			if (c && c.sort === sort) {
				if (sort === 'hot') {
					conditions.push(
						or(sql`${score} < ${c.key}`, and(sql`${score} = ${c.key}`, lt(stories.id, c.id)))!,
					)
				} else {
					const d = new Date(c.key)
					conditions.push(
						or(
							lt(stories.publishedAt, d),
							and(sql`${stories.publishedAt} = ${d.toISOString()}`, lt(stories.id, c.id)),
						)!,
					)
				}
			}
		}

		const where = and(...conditions)

		const rows = await this.db
			.select({ ...getTableColumns(stories), _score: score })
			.from(stories)
			.where(where)
			.orderBy(
				...(sort === 'hot'
					? [sql`${score} desc`, desc(stories.id)]
					: [desc(stories.publishedAt), desc(stories.id)]),
			)
			.limit(limit + 1)

		const hasMore = rows.length > limit
		const page = hasMore ? rows.slice(0, limit) : rows
		const items = page.map(({ _score, ...s }) => s)
		const last = page.at(-1)

		let nextCursor: string | null = null
		if (hasMore && last) {
			nextCursor =
				sort === 'hot'
					? encodeFeedCursor('hot', last._score, last.id)
					: last.publishedAt
						? encodeFeedCursor('new', last.publishedAt.getTime(), last.id)
						: null
		}

		return { items, nextCursor }
	}

	async findOptionsForStories(storyIds: string[]): Promise<DbVoteOption[]> {
		if (storyIds.length === 0) return []
		return this.db
			.select()
			.from(voteOptions)
			.where(inArray(voteOptions.storyId, storyIds))
			.orderBy(voteOptions.position)
	}

	async findByAuthor(authorId: string, query: AuthorQuery = {}): Promise<PaginatedStories> {
		const limit = query.limit ?? 20
		const conditions = [eq(stories.authorId, authorId)]

		if (query.cursor) {
			const c = decodeCursor(query.cursor)
			if (c) {
				conditions.push(
					or(
						lt(stories.createdAt, c.date),
						and(sql`${stories.createdAt} = ${c.date.toISOString()}`, lt(stories.id, c.id)),
					)!,
				)
			}
		}

		const rows = await this.db
			.select()
			.from(stories)
			.where(and(...conditions))
			.orderBy(desc(stories.createdAt), desc(stories.id))
			.limit(limit + 1)

		const hasMore = rows.length > limit
		const items = hasMore ? rows.slice(0, limit) : rows
		const last = items.at(-1)
		const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null

		return { items, nextCursor }
	}
}
