import { StreamEventType } from '@nowhere-team/tellme-sdk'

import { type AiResponse, validatePlaceholders } from './schema'
import type { AiCallbacks, AiProcessInput, AiProcessor } from './types'

export class FakeAiProcessor implements AiProcessor {
	private responses: AiResponse[] = []

	constructor(private readonly callbacks: AiCallbacks) {}

	enqueue(response: AiResponse): void {
		this.responses.push(response)
	}

	reset(): void {
		this.responses = []
	}

	start(input: AiProcessInput): void {
		queueMicrotask(() => this.run(input))
	}

	private async run(input: AiProcessInput): Promise<void> {
		const { publish, onAccepted, onRejected } = this.callbacks
		const response = this.responses.shift() ?? this.defaultAccepted(input.raw)

		if (response.decision === 'accepted') {
			validatePlaceholders(response.text, response.replacements)
			await onAccepted(input.storyId, response)
			publish(input.userId, {
				type: StreamEventType.Ready,
				createdAt: new Date(),
				storyId: input.storyId,
				status: 'ready',
				title: response.title,
				text: response.text,
				replacements: response.replacements,
				category: response.category,
				warnings: response.warnings,
			})
		} else {
			await onRejected(input.storyId, response)
			publish(input.userId, {
				type: StreamEventType.Rejected,
				createdAt: new Date(),
				storyId: input.storyId,
				status: 'rejected',
				code: response.code,
				message: response.message,
			})
		}
	}

	private defaultAccepted(raw: string): Extract<AiResponse, { decision: 'accepted' }> {
		return {
			decision: 'accepted',
			headline: 'история без названия',
			title: 'Был ли я прав?',
			preview:
				'Произошла ситуация, в которой автор не уверен как поступил. Сообщество должно решить.',
			text: raw,
			replacements: {},
			category: 'other',
			options: [
				{ label: 'Ты был прав', position: 0 },
				{ label: 'Ты перегнул', position: 1 },
			],
			warnings: [],
		}
	}
}
