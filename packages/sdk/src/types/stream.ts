import type { Category, Rejection, StoryStatus, StreamEventType, Warning } from '@/enums'

interface StreamEventBase {
	createdAt: Date
	storyId: string
}

export interface StreamChunkEvent extends StreamEventBase {
	type: typeof StreamEventType.Chunk
	key: string
	value: unknown
}

export interface StreamReadyEvent extends StreamEventBase {
	type: typeof StreamEventType.Ready
	status: typeof StoryStatus.Ready
	title: string
	text: string
	replacements: Record<string, string>
	category: Category
	warnings: Warning[]
}

export interface StreamRejectedEvent extends StreamEventBase {
	type: typeof StreamEventType.Rejected
	status: typeof StoryStatus.Rejected
	code: Rejection
	message: string
}

export interface StreamFailedEvent extends StreamEventBase {
	type: typeof StreamEventType.Failed
	message: string
}

export type StreamEvent =
	| StreamChunkEvent
	| StreamReadyEvent
	| StreamRejectedEvent
	| StreamFailedEvent
