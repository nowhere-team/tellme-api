import { z } from 'zod'

import { VISIBILITIES } from '@/enums'

import { pagination, uuid } from './common'

export const submitDraft = z.object({
	raw: z.string().min(50).max(5000),
	visibility: z.enum(VISIBILITIES).default('open'),
})

export const castVote = z.object({
	optionId: uuid,
})

export const feedQuery = pagination.extend({
	category: z.string().optional(),
})

export const authorQuery = pagination

export type SubmitDraftInput = z.infer<typeof submitDraft>
export type CastVoteInput = z.infer<typeof castVote>
export type FeedQuery = z.infer<typeof feedQuery>
export type AuthorQuery = z.infer<typeof authorQuery>
