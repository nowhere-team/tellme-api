import { buildDisplayId, DICTIONARY, formatUsername, type Language } from '@nowhere-team/tellme-sdk'
import { Hono } from 'hono'

import { AppError } from '@/common/errors'
import type { AuthEnv } from '@/http/middleware/auth'
import type { Repositories } from '@/repositories'

export function createUserRoutes(repos: Repositories) {
	const app = new Hono<AuthEnv>()

	app.get('/me', async c => {
		const auth = c.get('auth')
		if (!auth) throw AppError.forbidden('not authenticated')

		const user = await repos.users.findById(auth.sub)
		if (!user) throw AppError.notFound('user')

		return c.json({
			id: user.id,
			username: user.username,
			displayName: formatUsername(user.username, user.locale as Language),
			role: user.role,
		})
	})

	app.get('/username-preview', async c => {
		// returns 4 candidate display names without creating accounts
		const adjCount = DICTIONARY.ru.adjectives.length
		const nounCount = DICTIONARY.ru.nouns.length
		const candidates = Array.from({ length: 4 }, () => {
			const aIdx = Math.floor(Math.random() * adjCount)
			const nIdx = Math.floor(Math.random() * nounCount)
			return formatUsername(buildDisplayId(aIdx, nIdx, 0))
		})
		return c.json({ candidates })
	})

	return app
}
