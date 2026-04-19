import type { StreamEvent } from '@/types'

export interface StreamConnectOptions {
	baseUrl: string
	getToken?: () => string | Promise<string>
	signal?: AbortSignal
}

export class StreamResource {
	constructor(private readonly opts: StreamConnectOptions) {}

	async *connect(): AsyncGenerator<StreamEvent> {
		const reader = await this.executeRequest()
		yield* this.readStream(reader)
	}

	private async executeRequest() {
		const url = `${this.opts.baseUrl.replace(/\/$/, '')}/api/v1/stream`
		const headers: Record<string, string> = { Accept: 'text/event-stream' }

		if (this.opts.getToken) {
			headers.Authorization = `Bearer ${await this.opts.getToken()}`
		}

		const res = await fetch(url, {
			method: 'GET',
			headers,
			credentials: 'include',
			signal: this.opts.signal,
		})

		if (!res.ok || !res.body) {
			throw new Error(`stream connection failed: ${res.status}`)
		}

		return res.body.getReader()
	}

	private async *readStream(reader: any): AsyncGenerator<StreamEvent> {
		const decoder = new TextDecoder()
		let buffer = ''

		try {
			while (true) {
				const { done, value } = await reader.read()
				if (done) return

				buffer += decoder.decode(value, { stream: true })
				buffer = yield* this.extractFrames(buffer)
			}
		} finally {
			try {
				reader.releaseLock()
			} catch {}
		}
	}

	private *extractFrames(buffer: string): Generator<StreamEvent, string> {
		let currentBuffer = buffer

		while (true) {
			const idx = currentBuffer.indexOf('\n\n')
			if (idx === -1) break

			const frame = currentBuffer.slice(0, idx)
			currentBuffer = currentBuffer.slice(idx + 2)

			const parsed = parseFrame(frame)
			if (parsed) yield parsed
		}

		return currentBuffer
	}
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

function dateReviver(_key: string, value: unknown): unknown {
	if (typeof value === 'string' && ISO_RE.test(value)) return new Date(value)
	return value
}

function parseFrame(frame: string): StreamEvent | null {
	let data = ''
	for (const line of frame.split('\n')) {
		if (line.startsWith('data: ')) data += line.slice(6)
		else if (line.startsWith('data:')) data += line.slice(5)
	}
	if (!data) return null
	try {
		return JSON.parse(data, dateReviver) as StreamEvent
	} catch {
		return null
	}
}
