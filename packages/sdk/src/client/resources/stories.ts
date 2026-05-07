import type { z } from 'zod'

import type { BaseClient } from '@/client/base'
import type { stories as storySchemas } from '@/schemas'
import type { PaginatedStoryViews, StoryResponse, StoryViewResponse, VoteResponse } from '@/types'

type SubmitDraftInput = z.infer<typeof storySchemas.submitDraft>
type CastVoteInput = z.infer<typeof storySchemas.castVote>
type FeedQuery = z.infer<typeof storySchemas.feedQuery>
type AuthorQuery = z.infer<typeof storySchemas.authorQuery>

export class StoriesResource {
	constructor(private client: BaseClient) {}

	feed = (query: FeedQuery = { limit: 20, sort: 'hot' }) =>
		this.client.request<PaginatedStoryViews>('GET', '/stories', {
			query: flatten(query),
		})

	get = (id: string) => this.client.request<StoryViewResponse>('GET', `/stories/${id}`)

	submit = (input: SubmitDraftInput) =>
		this.client.request<StoryResponse>('POST', '/stories', { body: input })

	publish = (id: string) =>
		this.client.request<{ story: StoryResponse['story'] }>('POST', `/stories/${id}/publish`)

	vote = (id: string, input: CastVoteInput) =>
		this.client.request<VoteResponse>('POST', `/stories/${id}/vote`, { body: input })

	byAuthor = (query: AuthorQuery = { limit: 20 }) =>
		this.client.request<PaginatedStoryViews>('GET', '/users/me/stories', {
			query: flatten(query),
		})
}

function flatten(
	q: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
	const out: Record<string, string | number | boolean | undefined> = {}
	for (const [k, v] of Object.entries(q)) {
		if (v === undefined || v === null) continue
		if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v
	}
	return out
}
