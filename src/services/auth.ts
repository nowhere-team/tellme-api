import { formatUsername, type Language, resolveDisplayName } from '@nowhere-team/tellme-sdk'

import {
	buildTotpUri,
	generateMnemonic,
	generateTotpSecret,
	hashPassword,
	type JwtConfig,
	mnemonicToHash,
	randomSalt,
	sha256WithSalt,
	signToken,
	type TokenPayload,
	verifyPassword,
	verifyTotp,
} from '@/common/crypto'
import { AppError } from '@/common/errors'
import type { Repositories } from '@/repositories'
import type { DbUser } from '@/repositories/users'
import type { SessionsService } from '@/services/sessions'

export interface AuthConfig {
	jwt: JwtConfig
	sessionTtl: number
}

export interface PublicUser {
	id: string
	username: string
	displayName: string
	role: string
}

export interface RegisterInput {
	password: string
	locale?: Language
	enableTotp?: boolean
	userAgent: string | null
	ip: string
}

export interface RegisterResult {
	user: PublicUser
	mnemonic: string
	totpUri: string | null
	accessToken: string
}

export interface LoginInput {
	username: string
	password: string
	totpCode?: string
	userAgent: string | null
	ip: string
}

export interface LoginResult {
	user: PublicUser
	accessToken: string
}

export class AuthService {
	constructor(
		private readonly repos: Repositories,
		private readonly sessions: SessionsService,
		private readonly config: AuthConfig,
	) {}

	async register(input: RegisterInput): Promise<RegisterResult> {
		const mnemonic = generateMnemonic(12)
		const recoveryHash = mnemonicToHash(mnemonic)
		const passwordHash = await hashPassword(input.password)
		// Generate the secret so we can show the QR, but DON'T activate 2FA yet —
		// it stays off until the user proves they can produce a code (enableTotp).
		// This keeps the step optional and avoids locking out users who skip it.
		const totpSecret = input.enableTotp ? generateTotpSecret() : null

		const user = await this.repos.users.create({
			passwordHash,
			recoveryHash,
			totpSecret: null,
			locale: input.locale,
		})

		const accessToken = await this.issueSession(user, input.userAgent, input.ip)
		const totpUri = totpSecret ? buildTotpUri(totpSecret, user.username) : null

		return { user: toPublic(user), mnemonic, totpUri, accessToken }
	}

	// Confirm-to-enable: activate 2FA only after the user proves they can produce
	// a valid code from the secret shown in the QR. The secret round-trips through
	// the client (it was only ever delivered in the QR, never stored).
	async enableTotp(userId: string, secret: string, code: string): Promise<void> {
		if (!verifyTotp(secret, code)) throw AppError.validation('invalid totp code')
		await this.repos.users.setTotpSecret(userId, secret)
	}

	async login(input: LoginInput): Promise<LoginResult> {
		const user = await this.resolveUser(input.username)
		if (!user) throw AppError.validation('invalid credentials')
		if (user.bannedAt) throw AppError.forbidden('user is banned')

		const ok = await verifyPassword(input.password, user.passwordHash)
		if (!ok) throw AppError.validation('invalid credentials')

		if (user.totpSecret) {
			if (!input.totpCode) throw AppError.validation('totp code required')
			if (!verifyTotp(user.totpSecret, input.totpCode)) {
				throw AppError.validation('invalid totp code')
			}
		}

		const accessToken = await this.issueSession(user, input.userAgent, input.ip)
		return { user: toPublic(user), accessToken }
	}

	async logout(sessionId: string): Promise<void> {
		await this.sessions.revoke(sessionId)
		await this.repos.sessions.delete(sessionId)
	}

	async recover(mnemonic: string, newPassword: string): Promise<void> {
		const hash = mnemonicToHash(mnemonic)
		const user = await this.repos.users.findByRecoveryHash(hash)
		if (!user) throw AppError.validation('invalid recovery phrase')

		const passwordHash = await hashPassword(newPassword)
		await this.repos.users.setPasswordHash(user.id, passwordHash)

		const existing = await this.repos.sessions.findAllByUserId(user.id)
		await this.sessions.revokeAllForUser(existing.map(s => s.id))
		await this.repos.sessions.deleteAllByUserId(user.id)
	}

	// Login accepts the human nick the user actually typed ("ТёплыйВетер#0").
	// An already-encoded handle ("12:34:0") is looked up directly; otherwise we
	// reverse the nick into candidate handles (across locales) and pick the one
	// that maps to a real user.
	private async resolveUser(identifier: string): Promise<DbUser | null> {
		const handle = identifier.trim()
		if (/^\d+:\d+:\d+$/.test(handle)) {
			return this.repos.users.findByUsername(handle)
		}

		const candidates = new Set<string>([
			...resolveDisplayName(handle, 'ru'),
			...resolveDisplayName(handle, 'en'),
		])
		for (const candidate of candidates) {
			const user = await this.repos.users.findByUsername(candidate)
			if (user) return user
		}
		return null
	}

	private async issueSession(user: DbUser, userAgent: string | null, ip: string): Promise<string> {
		const ipSalt = randomSalt()
		const session = await this.repos.sessions.create({
			userId: user.id,
			userAgent,
			ipHash: sha256WithSalt(ip, ipSalt),
			ipSalt,
			ttlSeconds: this.config.sessionTtl,
		})

		await this.sessions.activate(session.id, this.config.sessionTtl)

		const payload: TokenPayload = { sub: user.id, jti: session.id, role: user.role }
		return signToken(payload, this.config.jwt)
	}
}

function toPublic(user: DbUser): PublicUser {
	return {
		id: user.id,
		username: user.username,
		displayName: formatUsername(user.username, user.locale as Language),
		role: user.role,
	}
}
