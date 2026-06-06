import { formatUsername, type Language } from '@nowhere-team/tellme-sdk'

import { AppError } from '@/common/errors'
import type { Repositories } from '@/repositories'
import type { DbComment } from '@/repositories/comments'
import type { DbUser } from '@/repositories/users'

import type { CommentModerator } from './ai/comment-moderator'

function displayNameFor(user: DbUser | undefined | null): string | null {
	if (!user) return null
	return formatUsername(user.username, user.locale as Language)
}

export interface CommentView extends Omit<DbComment, 'authorId'> {
	authorId: string | null
	displayName: string | null
	isAuthor: boolean
	replies: CommentView[]
}

export interface PostCommentInput {
	content: string
	parentId: string | null
}

export class CommentService {
	constructor(
		private readonly repos: Repositories,
		private readonly moderator: CommentModerator,
		private readonly bots?: {
			replyToComment: (storyId: string, comment: DbComment) => Promise<void>
		},
	) {}

	async post(storyId: string, userId: string, input: PostCommentInput): Promise<CommentView> {
		const story = await this.repos.stories.findById(storyId)
		if (!story) throw AppError.notFound('story', storyId)
		if (story.status !== 'published') throw AppError.validation('story is not open for comments')

		if (input.parentId) {
			const parent = await this.repos.comments.findById(input.parentId)
			if (!parent || parent.storyId !== storyId) throw AppError.notFound('comment', input.parentId)
		}

		const verdict = await this.moderator.check(input.content)
		if (verdict === 'reject') throw AppError.validation('comment violates community rules')

		const comment = await this.repos.comments.create({
			storyId,
			authorId: userId,
			parentId: input.parentId,
			content: input.content,
		})

		const user = await this.repos.users.findById(userId)
		// fire-and-forget: real users get bot replies in their threads (bots post
		// directly via repos, so they never reach this path and can't self-trigger)
		if (!user?.botPersona) void this.bots?.replyToComment(storyId, comment)

		return this.toView(comment, story.authorId, user ?? null, [])
	}

	async getTree(storyId: string): Promise<CommentView[]> {
		const story = await this.repos.stories.findById(storyId)
		if (!story) throw AppError.notFound('story', storyId)

		const all = await this.repos.comments.findByStory(storyId)
		const uniqueAuthorIds = [...new Set(all.map(c => c.authorId))]
		const users = await this.repos.users.findManyByIds(uniqueAuthorIds)
		const userMap = new Map<string, DbUser>(users.map(u => [u.id, u]))

		return this.buildTree(all, null, story.authorId, userMap)
	}

	private buildTree(
		all: DbComment[],
		parentId: string | null,
		storyAuthorId: string,
		userMap: Map<string, DbUser>,
	): CommentView[] {
		return all
			.filter(c => c.parentId === parentId)
			.map(c => ({
				...c,
				authorId: c.authorId,
				displayName: displayNameFor(userMap.get(c.authorId)),
				isAuthor: c.authorId === storyAuthorId,
				replies: this.buildTree(all, c.id, storyAuthorId, userMap),
			}))
	}

	private toView(
		comment: DbComment,
		storyAuthorId: string,
		user: DbUser | null,
		replies: CommentView[],
	): CommentView {
		return {
			...comment,
			authorId: comment.authorId,
			displayName: displayNameFor(user),
			isAuthor: comment.authorId === storyAuthorId,
			replies,
		}
	}
}
