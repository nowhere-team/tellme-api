// noinspection D

import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'

import { type TokenPayload, verifyToken } from '@/common/crypto'
import { AppError } from '@/common/errors'
import type { SessionsService } from '@/services/sessions'

export type AuthEnv = { Variables: { auth: TokenPayload } }

export function authMiddleware(
	secret: string,
	sessions: SessionsService,
	optional = false,
): MiddlewareHandler<AuthEnv> {
	return async (c, next) => {
		const token = getCookie(c, 'access_token') ?? extractBearer(c.req.header('Authorization'))

		if (!token) {
			if (optional) return await next()
			throw AppError.forbidden('not authenticated')
		}

		let payload: TokenPayload
		try {
			payload = await verifyToken(token, secret)
		} catch {
			if (optional) return await next()
			throw AppError.forbidden('invalid token')
		}

		if (!(await sessions.isActive(payload.jti))) {
			if (optional) return await next()
			throw AppError.forbidden('session revoked')
		}

		c.set('auth', payload)
		await next()
	}
}

function extractBearer(header: string | undefined): string | null {
	if (!header?.startsWith('Bearer ')) return null
	return header.slice(7)
}
