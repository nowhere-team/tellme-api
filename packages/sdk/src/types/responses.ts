import type { CommentView, Story, StoryView, VoteOption } from './domain'

export interface StoryResponse {
	story: Story
}

export interface StoryViewResponse {
	story: Story
	options: VoteOption[]
	userVote: string | null
	commentCount: number
}

export interface PaginatedStoryViews {
	items: StoryView[]
	nextCursor: string | null
}

export interface VoteResponse {
	vote: {
		id: string
		storyId: string
		userId: string
		optionId: string
		createdAt: Date
	}
}

export interface CommentResponse {
	comment: CommentView
}

export interface CommentsResponse {
	comments: CommentView[]
}

export interface MeResponse {
	id: string
	username: string
	displayName: string
	role: string
}

export interface UsernamePreviewResponse {
	candidates: string[]
}
