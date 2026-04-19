import { auth as authSchemas } from '@nowhere-team/tellme-sdk'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'

import type { AuthEnv } from '@/http/middleware/auth'
import type { AuthService } from '@/services/auth'

export function createAuthRoutes(auth: AuthService, accessTtl: number) {
	const app = new Hono<AuthEnv>()

	app.post('/register', async c => {
		const body = authSchemas.register.parse(await c.req.json())
		const userAgent = c.req.header('User-Agent') ?? null
		const ip = c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ?? '0.0.0.0'
		const result = await auth.register({ ...body, userAgent, ip })
		setAccessCookie(c, result.accessToken, accessTtl)
		return c.json({
			user: result.user,
			mnemonic: result.mnemonic,
			totpUri: result.totpUri,
			accessToken: result.accessToken,
		})
	})

	app.post('/login', async c => {
		const body = authSchemas.login.parse(await c.req.json())
		const userAgent = c.req.header('User-Agent') ?? null
		const ip = c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ?? '0.0.0.0'
		const result = await auth.login({ ...body, userAgent, ip })
		setAccessCookie(c, result.accessToken, accessTtl)
		return c.json({ user: result.user, accessToken: result.accessToken })
	})
	app.post('/logout', async c => {
		const payload = c.get('auth')
		if (payload?.jti) await auth.logout(payload.jti)
		deleteCookie(c, 'access_token', { path: '/' })
		return c.body(null, 204)
	})

	app.post('/recover', async c => {
		const body = authSchemas.recover.parse(await c.req.json())
		await auth.recover(body.mnemonic, body.newPassword)
		return c.body(null, 204)
	})

	return app
}

function setAccessCookie(c: Context, token: string, ttlSeconds: number) {
	setCookie(c, 'access_token', token, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'Strict',
		maxAge: ttlSeconds,
	})
}
