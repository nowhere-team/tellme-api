export interface HealthResponse {
	status: string
}

export interface ReadyResponse {
	status: 'ok' | 'degraded'
	checks: Record<string, 'ok' | 'fail'>
}
