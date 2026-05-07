import { stories as storySchemas } from '@nowhere-team/tellme-sdk'
import { Hono } from 'hono'

import { AppError } from '@/common/errors'
import type { AuthEnv } from '@/http/middleware/auth'
import type { PublicStory, StoryService } from '@/services/stories'

function serializeStory(story: PublicStory) {
	const { rejectionCode, rejectionMessage, ...rest } = story as PublicStory & {
		rejectionCode: string | null
		rejectionMessage: string | null
	}
	return {
		...rest,
		rejection:
			rejectionCode != null ? { code: rejectionCode, message: rejectionMessage ?? '' } : null,
	}
}

export function createStoryRoutes(stories: StoryService) {
	const app = new Hono<AuthEnv>()

	app.get('/', async c => {
		const query = storySchemas.feedQuery.parse(c.req.query())
		const viewerId = c.get('auth')?.sub ?? null
		const page = await stories.getFeed(query, viewerId)
		return c.json({
			...page,
			items: page.items.map(item => ({ ...item, story: serializeStory(item.story) })),
		})
	})

	app.post('/', async c => {
		const auth = c.get('auth')
		if (!auth) throw AppError.forbidden('authentication required')

		const body = storySchemas.submitDraft.parse(await c.req.json())
		const draft = await stories.submitDraft(auth.sub, body)
		return c.json({ story: serializeStory(draft as PublicStory) }, 201)
	})

	app.get('/:id', async c => {
		const viewerId = c.get('auth')?.sub ?? null
		const view = await stories.getById(c.req.param('id'), viewerId)
		return c.json({ ...view, story: serializeStory(view.story) })
	})

	app.post('/:id/publish', async c => {
		const auth = c.get('auth')
		if (!auth) throw AppError.forbidden('authentication required')

		const story = await stories.publish(c.req.param('id'), auth.sub)
		return c.json({ story: serializeStory(story) })
	})

	app.post('/:id/vote', async c => {
		const auth = c.get('auth')
		if (!auth) throw AppError.forbidden('authentication required')

		const body = storySchemas.castVote.parse(await c.req.json())
		const vote = await stories.castVote(c.req.param('id'), auth.sub, body.optionId)
		return c.json({ vote }, 201)
	})

	return app
}

export function createUserStoryRoutes(stories: StoryService) {
	const app = new Hono<AuthEnv>()

	app.get('/me/stories', async c => {
		const auth = c.get('auth')
		if (!auth) throw AppError.forbidden('authentication required')

		const query = storySchemas.authorQuery.parse(c.req.query())
		const page = await stories.getByAuthor(auth.sub, auth.sub, query)
		return c.json({
			...page,
			items: page.items.map(item => ({ ...item, story: serializeStory(item.story) })),
		})
	})

	return app
}
