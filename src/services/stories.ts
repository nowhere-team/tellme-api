import type { Category, Locale, stories as storySchemas, Warning } from '@nowhere-team/tellme-sdk'
import type { z } from 'zod'

import { AppError } from '@/common/errors'
import type { Repositories } from '@/repositories'
import type { DbStory, DbVoteOption, PaginatedStories } from '@/repositories/stories'
import type { DbVote } from '@/repositories/votes'

import type { AiAccepted, AiProcessor, AiRejected } from './ai'

// authorId is nullable: null means attribution hidden from the viewer.
export interface PublicStory extends Omit<DbStory, 'authorId'> {
	authorId: string | null
}

export interface StoryView {
	story: PublicStory
	options: DbVoteOption[]
	userVote: string | null
	commentCount: number
}

export interface PaginatedStoryViews {
	items: StoryView[]
	nextCursor: string | null
}

type SubmitDraftInput = z.infer<typeof storySchemas.submitDraft>
type FeedQuery = z.infer<typeof storySchemas.feedQuery>
type AuthorQuery = z.infer<typeof storySchemas.authorQuery>

export class StoryService {
	constructor(
		private readonly repos: Repositories,
		private readonly ai: AiProcessor,
		private readonly bots?: { swarmStory: (storyId: string) => Promise<void> },
	) {}

	async submitDraft(authorId: string, input: SubmitDraftInput): Promise<DbStory> {
		const author = await this.repos.users.findById(authorId)
		if (!author) throw AppError.forbidden('author not found')

		const locale = (author.locale === 'en' ? 'en' : 'ru') as Locale

		const story = await this.repos.stories.createProcessing({
			authorId,
			raw: input.raw,
			visibility: input.visibility,
			locale,
		})

		this.ai.start({
			storyId: story.id,
			userId: authorId,
			raw: input.raw,
			locale,
		})

		return story
	}

	async applyAiAccepted(storyId: string, result: AiAccepted): Promise<void> {
		await this.repos.stories.applyAccepted(storyId, {
			headline: result.headline,
			title: result.title,
			preview: result.preview,
			text: result.text,
			replacements: result.replacements,
			category: result.category as Category,
			warnings: result.warnings as Warning[],
			options: result.options,
		})
	}

	async applyAiRejected(storyId: string, result: AiRejected): Promise<void> {
		await this.repos.stories.applyRejected(storyId, {
			code: result.code,
			message: result.message,
		})
	}

	async applyAiFailed(storyId: string, message: string): Promise<void> {
		await this.repos.stories.applyRejected(storyId, {
			code: 'processing_error',
			message,
		})
	}

	async publish(storyId: string, userId: string): Promise<PublicStory> {
		const story = await this.repos.stories.findById(storyId)
		if (!story) throw AppError.notFound('story', storyId)
		if (story.authorId !== userId) throw AppError.forbidden('not the author')
		if (story.status !== 'ready') {
			throw AppError.conflict(`story is not ready for publishing (status=${story.status})`)
		}

		const published = await this.repos.stories.publish(storyId)
		if (!published) throw AppError.conflict('failed to publish')
		// fire-and-forget: let the bot crowd swarm the freshly published story
		void this.bots?.swarmStory(storyId)
		return this.toPublic(published, userId)
	}

	async getById(storyId: string, viewerId: string | null): Promise<StoryView> {
		const detail = await this.repos.stories.findByIdWithOptions(storyId)
		if (!detail) throw AppError.notFound('story', storyId)
		if (detail.status === 'hidden') throw AppError.notFound('story', storyId)

		// non-terminal states are only visible to the author
		if (detail.status !== 'published' && detail.authorId !== viewerId) {
			throw AppError.notFound('story', storyId)
		}

		const [userVote, counts] = await Promise.all([
			viewerId ? this.repos.votes.findUserVote(storyId, viewerId) : Promise.resolve(null),
			this.repos.comments.countForStories([storyId]),
		])

		return {
			story: this.toPublic(detail, viewerId),
			options: detail.options,
			userVote: userVote?.optionId ?? null,
			commentCount: counts.get(storyId) ?? 0,
		}
	}

	async getRawById(storyId: string): Promise<DbStory | null> {
		return this.repos.stories.findById(storyId)
	}

	async getFeed(query: FeedQuery, viewerId: string | null): Promise<PaginatedStoryViews> {
		const page = await this.repos.stories.findFeed(query)
		return this.hydrate(page, viewerId)
	}

	async getByAuthor(
		authorId: string,
		viewerId: string | null,
		query: AuthorQuery,
	): Promise<PaginatedStoryViews> {
		const page = await this.repos.stories.findByAuthor(authorId, query)
		const isOwner = viewerId === authorId

		const filtered: PaginatedStories = {
			...page,
			items: isOwner
				? page.items
				: page.items.filter(s => s.status === 'published' && s.visibility === 'open'),
		}

		return this.hydrate(filtered, viewerId)
	}

	async castVote(storyId: string, userId: string, optionId: string): Promise<DbVote> {
		const story = await this.repos.stories.findById(storyId)
		if (!story) throw AppError.notFound('story', storyId)
		if (story.status !== 'published') throw AppError.validation('story is not open for voting')
		if (story.authorId === userId) throw AppError.forbidden('cannot vote on own story')

		const existing = await this.repos.votes.findUserVote(storyId, userId)
		if (existing) throw AppError.conflict('already voted')

		return this.repos.votes.cast(storyId, userId, optionId)
	}

	async hide(storyId: string): Promise<void> {
		await this.repos.stories.hide(storyId)
	}

	async restore(storyId: string): Promise<void> {
		await this.repos.stories.restore(storyId)
	}

	private async hydrate(
		page: PaginatedStories,
		viewerId: string | null,
	): Promise<PaginatedStoryViews> {
		if (page.items.length === 0) return { items: [], nextCursor: page.nextCursor }

		const ids = page.items.map(s => s.id)
		const [options, userVotes, commentCounts] = await Promise.all([
			this.repos.stories.findOptionsForStories(ids),
			viewerId ? this.repos.votes.findUserVotesForStories(viewerId, ids) : Promise.resolve([]),
			this.repos.comments.countForStories(ids),
		])

		const optionsByStory = new Map<string, DbVoteOption[]>()
		for (const o of options) {
			const bucket = optionsByStory.get(o.storyId) ?? []
			bucket.push(o)
			optionsByStory.set(o.storyId, bucket)
		}

		const voteByStory = new Map<string, string>()
		for (const v of userVotes) voteByStory.set(v.storyId, v.optionId)

		return {
			items: page.items.map(s => ({
				story: this.toPublic(s, viewerId),
				options: optionsByStory.get(s.id) ?? [],
				userVote: voteByStory.get(s.id) ?? null,
				commentCount: commentCounts.get(s.id) ?? 0,
			})),
			nextCursor: page.nextCursor,
		}
	}

	private toPublic(story: DbStory, viewerId: string | null): PublicStory {
		if (story.visibility === 'anonymous' && story.authorId !== viewerId) {
			return { ...story, authorId: null }
		}
		return story
	}
}
