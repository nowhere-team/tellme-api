import { StreamEventType } from '@nowhere-team/tellme-sdk'

import type { Logger } from '@/platform/logger'
import type { OpenRouterClient } from '@/platform/openrouter'

import { buildUserPrompt, SYSTEM_PROMPT } from './prompts'
import { type AiResponse, aiResponseSchema, getAiJsonSchema, validatePlaceholders } from './schema'
import type { AiCallbacks, AiProcessInput, AiProcessor } from './types'

const STREAM_PATHS = [
	'$.decision',
	'$.title',
	'$.text',
	'$.category',
	'$.warnings',
	'$.options.*',
	'$.code',
	'$.message',
]

export class GeminiAiProcessor implements AiProcessor {
	constructor(
		private readonly openrouter: OpenRouterClient,
		private readonly callbacks: AiCallbacks,
		private readonly logger: Logger,
	) {}

	start(input: AiProcessInput): void {
		queueMicrotask(() => this.run(input))
	}

	private async run(input: AiProcessInput): Promise<void> {
		const { publish, onAccepted, onRejected, onFailed } = this.callbacks

		try {
			const { chunks, final } = this.openrouter.generateStream<AiResponse>({
				system: SYSTEM_PROMPT,
				user: buildUserPrompt(input.raw, input.locale),
				schema: getAiJsonSchema(),
				temperature: 0.3,
				paths: STREAM_PATHS,
			})

			for await (const chunk of chunks) {
				publish(input.userId, {
					type: StreamEventType.Chunk,
					createdAt: new Date(),
					storyId: input.storyId,
					key: chunk.key,
					value: chunk.value,
				})
			}

			const parsed = aiResponseSchema.parse(await final)

			if (parsed.decision === 'accepted') {
				validatePlaceholders(parsed.text, parsed.replacements)
				await onAccepted(input.storyId, parsed)
				publish(input.userId, {
					type: StreamEventType.Ready,
					createdAt: new Date(),
					storyId: input.storyId,
					status: 'ready',
					title: parsed.title,
					text: parsed.text,
					replacements: parsed.replacements,
					category: parsed.category,
					warnings: parsed.warnings,
				})
			} else {
				await onRejected(input.storyId, parsed)
				publish(input.userId, {
					type: StreamEventType.Rejected,
					createdAt: new Date(),
					storyId: input.storyId,
					status: 'rejected',
					code: parsed.code,
					message: parsed.message,
				})
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'unknown error'
			this.logger.error('ai processing failed', err as Error)
			await onFailed(input.storyId, message).catch(() => {})
			publish(input.userId, {
				type: StreamEventType.Failed,
				createdAt: new Date(),
				storyId: input.storyId,
				message,
			})
		}
	}
}
