import type { z } from 'zod'

import type { BaseClient } from '@/client/base'
import type { auth as authSchemas } from '@/schemas'

type RegisterInput = z.infer<typeof authSchemas.register>
type LoginInput = z.infer<typeof authSchemas.login>
type RecoverInput = z.infer<typeof authSchemas.recover>

export interface PublicUser {
	id: string
	username: string
	displayName: string
	role: string
}

export interface RegisterResponse {
	user: PublicUser
	mnemonic: string
	totpUri: string | null
	accessToken: string
}

export interface LoginResponse {
	user: PublicUser
	accessToken: string
}

export class AuthResource {
	constructor(private client: BaseClient) {}

	register = (input: RegisterInput) =>
		this.client.request<RegisterResponse>('POST', '/auth/register', {
			body: input,
			skipAuth: true,
		})

	login = (input: LoginInput) =>
		this.client.request<LoginResponse>('POST', '/auth/login', {
			body: input,
			skipAuth: true,
		})

	logout = () => this.client.request<void>('POST', '/auth/logout')

	recover = (input: RecoverInput) =>
		this.client.request<void>('POST', '/auth/recover', {
			body: input,
			skipAuth: true,
		})
}
