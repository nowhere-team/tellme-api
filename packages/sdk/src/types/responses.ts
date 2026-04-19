import type { Story, StoryView, VoteOption } from './domain'

export interface StoryResponse {
	story: Story
}

export interface StoryViewResponse {
	story: Story
	options: VoteOption[]
	userVote: string | null
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
