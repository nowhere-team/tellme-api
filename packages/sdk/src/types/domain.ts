import type { StoryId, UserId, VoteOptionId } from '@/brand'
import type { Category, Locale, Rejection, StoryStatus, Visibility, Warning } from '@/enums'

// a single anonymizable replacement for one placeholder occurrence.
// placeholders in `text` look like {{original|groupId|id}}.
// all occurrences of the same person share the same groupId.
export type Replacements = Record<string, string>

export interface Story {
	id: StoryId
	authorId: UserId | null
	visibility: Visibility
	status: StoryStatus
	locale: Locale
	raw: string | null
	headline: string | null
	title: string | null
	preview: string | null
	text: string | null
	replacements: Replacements | null
	category: Category | null
	warnings: Warning[]
	rejection: { code: Rejection; message: string } | null
	totalVoteCount: number
	createdAt: Date
	updatedAt: Date
	publishedAt: Date | null
}

export interface CommentView {
	id: string
	storyId: string
	authorId: string | null
	displayName: string | null
	isAuthor: boolean
	parentId: string | null
	content: string
	createdAt: Date
	replies: CommentView[]
}

export type TextSegment =
	| { type: 'text'; value: string }
	| { type: 'placeholder'; groupId: number; id: number; replacement: string }

export interface VoteOption {
	id: VoteOptionId
	storyId: StoryId
	label: string
	position: number
	voteCount: number
}

export interface StoryView {
	story: Story
	options: VoteOption[]
	userVote: string | null
	commentCount: number
}
