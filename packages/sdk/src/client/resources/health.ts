import type { BaseClient } from '@/client/base'
import type { HealthResponse, ReadyResponse } from '@/types'

export class HealthResource {
	constructor(private client: BaseClient) {}

	check = () => this.client.request<HealthResponse>('GET', '/health', { skipAuth: true })

	live = () => this.client.request<HealthResponse>('GET', '/health/live', { skipAuth: true })

	ready = () => this.client.request<ReadyResponse>('GET', '/health/ready', { skipAuth: true })
}
