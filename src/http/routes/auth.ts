import { auth as authSchemas } from '@nowhere-team/tellme-sdk'
import { createChallenge, verifySolution } from 'altcha-lib'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'

import { AppError } from '@/common/errors'
import type { AuthEnv } from '@/http/middleware/auth'
import type { AuthService } from '@/services/auth'

export function createAuthRoutes(
	auth: AuthService,
	accessTtl: number,
	captchaKey: string,
	captchaEnabled: boolean,
) {
	const app = new Hono<AuthEnv>()

	// ALTCHA proof-of-work challenge — self-hosted, no external service.
	app.get('/altcha', async c => {
		const challenge = await createChallenge({ hmacKey: captchaKey, maxnumber: 100_000 })
		return c.json(challenge)
	})

	app.post('/register', async c => {
		const raw = (await c.req.json()) as Record<string, unknown>

		// verify the captcha solution produced by the widget (skipped in tests)
		if (captchaEnabled) {
			const solution = typeof raw.altcha === 'string' ? raw.altcha : null
			const ok = solution ? await verifySolution(solution, captchaKey) : false
			if (!ok) throw AppError.validation('captcha verification failed')
		}

		const body = authSchemas.register.parse(raw)
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

	// Activate 2FA for the authenticated user after verifying a code. The secret
	// comes from the client (it was shown in the QR at registration, never stored).
	const enableTotpSchema = z.object({
		secret: z.string().min(1),
		code: z.string().min(6).max(8),
	})
	app.post('/totp/enable', async c => {
		const payload = c.get('auth')
		if (!payload) throw AppError.forbidden('not authenticated')
		const body = enableTotpSchema.parse(await c.req.json())
		await auth.enableTotp(payload.sub, body.secret, body.code)
		return c.body(null, 204)
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
