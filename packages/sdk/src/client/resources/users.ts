import type { BaseClient } from '@/client/base'
import type { MeResponse, UsernamePreviewResponse } from '@/types'

export class UsersResource {
	constructor(private client: BaseClient) {}

	me = () => this.client.request<MeResponse>('GET', '/users/me')

	usernamePreviews = () =>
		this.client.request<UsernamePreviewResponse>('GET', '/users/username-preview', {
			skipAuth: true,
		})
}
