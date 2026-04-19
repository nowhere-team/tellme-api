import { OpenRouter } from '@openrouter/sdk'

import type { Logger } from '@/platform/logger'

import { AsyncQueue } from './async-queue'
import { StreamParser } from './stream-parser'
import type {
	GenerateParams,
	OpenRouterConfig,
	StreamChunk,
	StreamResult,
	UsageStats,
} from './types'

interface Deferred<T> {
	promise: Promise<T>
	resolve: (value: T) => void
	reject: (err: unknown) => void
}

function deferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void
	let reject!: (err: unknown) => void
	const promise = new Promise<T>((r, j) => {
		resolve = r
		reject = j
	})
	return { promise, resolve, reject }
}

export class OpenRouterClient {
	private readonly sdk: OpenRouter
	private readonly model: string
	private readonly logger: Logger

	constructor(config: OpenRouterConfig, logger: Logger) {
		this.model = config.model
		this.logger = logger.named('openrouter')
		this.sdk = new OpenRouter({
			apiKey: config.apiKey,
			serverURL: config.baseUrl,
		})
	}

	getModel(): string {
		return this.model
	}

	generateStream<T>(params: GenerateParams & { paths: string[] }): StreamResult<T> {
		const final = deferred<T>()
		const usage = deferred<UsageStats | undefined>()

		const chunks = this.run<T>(params, final, usage)
		return { chunks, final: final.promise, usage: usage.promise }
	}

	private async *run<T>(
		params: GenerateParams & { paths: string[] },
		final: Deferred<T>,
		usage: Deferred<UsageStats | undefined>,
	): AsyncGenerator<StreamChunk> {
		const started = performance.now()

		try {
			const queue = new AsyncQueue<StreamChunk>()
			const parser = new StreamParser<T>(params.paths, chunk => queue.push(chunk))
			const stream = await this.openStream(params)
			const producer = this.consume(stream, parser, queue)

			yield* queue.drain()

			const { generationId, usageStats } = await producer
			this.logCompletion(started, generationId, usageStats)

			const result = parser.getFinal()
			if (result === undefined) {
				final.reject(new Error('stream ended without a parseable object'))
				usage.resolve(usageStats)
				return
			}
			final.resolve(result)
			usage.resolve(usageStats)
		} catch (err) {
			this.logger.error('stream failed', err as Error)
			final.reject(err)
			usage.resolve(undefined)
			throw err
		}
	}

	private async openStream(params: GenerateParams & { paths: string[] }) {
		return (await this.sdk.chat.send(
			{
				chatRequest: {
					model: this.model,
					temperature: params.temperature ?? 0.2,
					stream: true,
					messages: [
						{ role: 'system', content: params.system },
						{ role: 'user', content: params.user },
					],
					...(params.schema && {
						responseFormat: {
							type: 'json_schema',
							jsonSchema: { name: 'response', strict: true, schema: params.schema },
						},
					}),
				},
			},
			{
				fetchOptions: { signal: params.signal },
			} as any,
		)) as unknown as AsyncIterable<any>
	}

	private async consume<T>(
		stream: AsyncIterable<any>,
		parser: StreamParser<T>,
		queue: AsyncQueue<StreamChunk>,
	): Promise<{ generationId: string | undefined; usageStats: UsageStats | undefined }> {
		let generationId: string | undefined
		let usageStats: UsageStats | undefined

		try {
			for await (const event of stream) {
				// noinspection JSUnusedAssignment
				generationId ??= event.id

				const delta = event.choices?.[0]?.delta?.content
				if (typeof delta === 'string') parser.write(delta)

				if (event.usage) usageStats = this.normalizeUsage(event.usage, generationId)
			}
		} finally {
			queue.close()
		}

		return { generationId, usageStats }
	}

	private normalizeUsage(raw: any, generationId: string | undefined): UsageStats {
		return {
			promptTokens: raw.promptTokens ?? raw.prompt_tokens ?? 0,
			completionTokens: raw.completionTokens ?? raw.completion_tokens ?? 0,
			totalTokens: raw.totalTokens ?? raw.total_tokens ?? 0,
			generationId,
		}
	}

	private logCompletion(
		started: number,
		generationId: string | undefined,
		usage: UsageStats | undefined,
	): void {
		this.logger.info('generated', {
			model: this.model,
			latencyMs: Math.round(performance.now() - started),
			generationId,
			usage,
		})
	}
}
