// noinspection ES6PreferShortImport

import type { z } from 'zod'

import type { comments as commentSchemas } from '../../schemas'
import type { CommentResponse, CommentsResponse } from '../../types'
import type { BaseClient } from '../base'

type PostCommentInput = z.infer<typeof commentSchemas.postComment>

export class CommentsResource {
	constructor(private client: BaseClient) {}

	getTree = (storyId: string) =>
		this.client.request<CommentsResponse>('GET', `/stories/${storyId}/comments`)

	post = (storyId: string, input: PostCommentInput) =>
		this.client.request<CommentResponse>('POST', `/stories/${storyId}/comments`, {
			body: input,
		})
}
