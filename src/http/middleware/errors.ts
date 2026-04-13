import type { ErrorHandler } from 'hono'
import { deleteCookie } from 'hono/cookie'

import { AppError } from '@/common/errors'
import type { Logger } from '@/platform/logger'

export function errorHandler(logger: Logger): ErrorHandler {
	return (err, c) => {
		if (err instanceof AppError) {
			return c.json({ code: err.code, message: err.message }, err.status as any)
		}

		// noinspection SuspiciousTypeOfGuard
		const msg = err instanceof Error ? err.message : String(err)

		if (msg.includes('violates foreign key constraint') && msg.includes('users_id')) {
			logger.warn('orphaned user token detected, clearing session', {
				path: c.req.path,
			})
			deleteCookie(c, 'access_token', { path: '/' })
			return c.json({ code: 'UNAUTHORIZED', message: 'user no longer exists' }, 401)
		}

		logger.error('unhandled error', { err, path: c.req.path })
		return c.json({ code: 'INTERNAL_ERROR', message: 'internal server error' }, 500)
	}
}
