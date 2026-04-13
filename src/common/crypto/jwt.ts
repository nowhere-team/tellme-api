import type { JWTPayload } from 'jose'
import * as jose from 'jose'

export interface TokenPayload extends JWTPayload {
	sub: string // user id
	jti: string // session id
	role: string
}

export interface JwtConfig {
	secret: string
	ttl: number // seconds
}

let encodedSecret: Uint8Array | null = null

function getSecret(secret: string): Uint8Array {
	if (!encodedSecret) {
		encodedSecret = new TextEncoder().encode(secret)
	}
	return encodedSecret
}

export async function signToken(payload: TokenPayload, config: JwtConfig): Promise<string> {
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime(`${config.ttl}s`)
		.sign(getSecret(config.secret))
}

export async function verifyToken(token: string, secret: string): Promise<TokenPayload> {
	const { payload } = await jose.jwtVerify(token, getSecret(secret))

	if (!payload.sub || !payload.jti) {
		throw new Error('invalid token payload')
	}

	return {
		sub: payload.sub,
		jti: payload.jti,
		role: (payload as any).role ?? 'user',
	}
}
