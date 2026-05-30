import { auth as authSchemas } from '@nowhere-team/tellme-sdk'
import { createChallenge, verifySolution } from 'altcha-lib'
import { Hono } from 'hono'

import { AppError } from '@/common/errors'
import type { AuthEnv } from '@/http/middleware/auth'
import type { AuthService } from '@/services/auth'

function getClientInfo(c: any): { userAgent: string; ip: string } {
	return {
		userAgent: c.req.header('user-agent') ?? 'unknown',
		ip: c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0',
	}
}

function setSessionCookie(c: any, token: string, maxAge: number) {
	const parts = [
		`tellme_session=${token}`,
		'HttpOnly',
		'Path=/',
		'SameSite=Lax',
		`Max-Age=${maxAge}`,
	]
	c.header('Set-Cookie', parts.join('; '))
}

export function createAuthRoutes(auth: AuthService, accessTtl: number, captchaKey: string) {
	const app = new Hono<AuthEnv>()

	// ALTCHA proof-of-work challenge — self-hosted, no external service.
	app.get('/altcha', async c => {
		const challenge = await createChallenge({ hmacKey: captchaKey, maxNumber: 100_000 })
		return c.json(challenge)
	})

	app.post('/register', async c => {
		const raw = (await c.req.json()) as Record<string, unknown>

		// verify the captcha solution produced by the widget
		const solution = typeof raw.altcha === 'string' ? raw.altcha : null
		const ok = solution ? await verifySolution(solution, captchaKey) : false
		if (!ok) throw AppError.validation('captcha verification failed')

		const body = authSchemas.register.parse(raw)
		const { userAgent, ip } = getClientInfo(c)
		const result = await auth.register({ ...body, userAgent, ip })

		setSessionCookie(c, result.accessToken, accessTtl)
		return c.json(result, 201)
	})

	app.post('/login', async c => {
		const body = authSchemas.login.parse(await c.req.json())
		const { userAgent, ip } = getClientInfo(c)
		const result = await auth.login({ ...body, userAgent, ip })

		setSessionCookie(c, result.accessToken, accessTtl)
		return c.json(result, 201)
	})

	app.post('/logout', async c => {
		const auth_ctx = c.get('auth')
		if (auth_ctx?.sessionId) await auth.logout(auth_ctx.sessionId)
		return c.body(null, 204)
	})

	app.post('/recover', async c => {
		const body = authSchemas.recover.parse(await c.req.json())
		await auth.recover(body.mnemonic, body.newPassword)
		return c.body(null, 204)
	})

	return app
}
