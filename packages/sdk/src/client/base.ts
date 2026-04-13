// noinspection JSUnusedGlobalSymbols

import { fetch } from 'bun'

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

function dateReviver(_key: string, value: unknown): unknown {
	if (typeof value === 'string' && ISO_RE.test(value)) return new Date(value)
	return value
}

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ClientConfig {
	baseUrl: string
	getToken?: () => string | Promise<string>
	credentials?: 'include' | 'omit'
}

export interface RequestOptions {
	body?: unknown
	query?: Record<string, string | number | boolean | undefined>
	skipAuth?: boolean
}

export class BaseClient {
	private readonly baseUrl: string
	private readonly getToken?: () => string | Promise<string>
	private readonly credentials: RequestInit['credentials']

	constructor(config: ClientConfig) {
		this.baseUrl = config.baseUrl.replace(/\/$/, '')
		this.getToken = config.getToken
		this.credentials = config.credentials ?? 'include'
	}

	async request<T>(method: Method, path: string, options?: RequestOptions): Promise<T> {
		const url = this.buildUrl(path, options)
		const headers = await this.buildHeaders(options)

		const res = await fetch(url, {
			method,
			headers,
			body: options?.body ? JSON.stringify(options.body) : undefined,
			credentials: this.credentials,
		})

		if (res.status === 204) return undefined as T

		const text = await res.text()

		if (!res.ok) {
			const data = JSON.parse(text) as { code?: string; message?: string }
			throw ApiError.fromResponse(data, res.status)
		}

		return JSON.parse(text, dateReviver) as T
	}

	private async buildHeaders(options?: RequestOptions): Promise<Record<string, string>> {
		const headers: Record<string, string> = { 'Content-Type': 'application/json' }

		if (!options?.skipAuth && this.getToken) {
			headers.Authorization = `Bearer ${await this.getToken()}`
		}

		return headers
	}

	private buildUrl(path: string, options?: RequestOptions): string {
		let url = `${this.baseUrl}/api/v1${path}`

		if (options?.query) {
			const params = new URLSearchParams()
			for (const [key, value] of Object.entries(options.query)) {
				if (value !== undefined) params.append(key, String(value))
			}
			const qs = params.toString()
			if (qs) url += `?${qs}`
		}

		return url
	}
}

export class ApiError extends Error {
	override readonly name = 'ApiError'

	constructor(
		readonly code: string,
		message: string,
		readonly status: number,
	) {
		super(message)
	}

	get isNotFound() {
		return this.code === 'NOT_FOUND'
	}
	get isForbidden() {
		return this.code === 'FORBIDDEN'
	}
	get isConflict() {
		return this.code === 'CONFLICT'
	}
	get isValidation() {
		return this.code === 'VALIDATION_ERROR'
	}
	get isUnauthorized() {
		return this.status === 401
	}

	static fromResponse(data: { code?: string; message?: string }, status: number): ApiError {
		return new ApiError(data.code ?? 'UNKNOWN', data.message ?? 'unknown error', status)
	}
}
