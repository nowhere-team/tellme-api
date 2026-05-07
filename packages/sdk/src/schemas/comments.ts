import { z } from 'zod'

export const postComment = z.object({
	content: z.string().min(1).max(2000),
	parentId: z.uuid().nullable().default(null),
})

export type PostCommentInput = z.infer<typeof postComment>
