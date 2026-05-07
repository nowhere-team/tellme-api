import { Hono } from 'hono'
import { z } from 'zod'

import { AppError } from '@/common/errors'
import type { AuthEnv } from '@/http/middleware/auth'
import type { CommentService } from '@/services/comments'

const postCommentSchema = z.object({
	content: z.string().min(1).max(2000),
	parentId: z.string().uuid().nullable().default(null),
})

export function createCommentRoutes(comments: CommentService) {
	const app = new Hono<AuthEnv>()

	app.get('/:storyId/comments', async c => {
		const tree = await comments.getTree(c.req.param('storyId'))
		return c.json({ comments: tree })
	})
	app.post('/:storyId/comments', async c => {
		const auth = c.get('auth')
		if (!auth) throw AppError.forbidden('authentication required')
		const body = postCommentSchema.parse(await c.req.json())
		const comment = await comments.post(c.req.param('storyId'), auth.sub, body)
		return c.json({ comment }, 201)
	})

	return app
}
