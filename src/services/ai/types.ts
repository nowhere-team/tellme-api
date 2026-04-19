import type { Locale, StreamEvent } from '@nowhere-team/tellme-sdk'

import type { AiAccepted, AiRejected } from './schema'

export interface AiProcessInput {
	storyId: string
	userId: string
	raw: string
	locale: Locale
}

export interface AiCallbacks {
	publish: (userId: string, event: StreamEvent) => void
	onAccepted: (storyId: string, result: AiAccepted) => Promise<void>
	onRejected: (storyId: string, result: AiRejected) => Promise<void>
	onFailed: (storyId: string, message: string) => Promise<void>
}

export interface AiProcessor {
	start(input: AiProcessInput): void
}
