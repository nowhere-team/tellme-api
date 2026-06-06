import type { Cache } from '@/platform/cache'
import type { Logger } from '@/platform/logger'
import type { OpenRouterClient } from '@/platform/openrouter'
import type { Repositories } from '@/repositories'

import { type AiCallbacks, type AiProcessor, FakeAiProcessor, GeminiAiProcessor } from './ai'
import { PassthroughCommentModerator } from './ai/comment-moderator'
import { type AuthConfig, AuthService } from './auth'
import { BotService } from './bots'
import { CommentService } from './comments'
import { SessionsService } from './sessions'
import { StoryService } from './stories'
import type { StreamBus } from './stream-bus'

export interface Services {
	auth: AuthService
	sessions: SessionsService
	stories: StoryService
	comments: CommentService
	bus: StreamBus
	ai: AiProcessor
	bots?: BotService
}

export interface ServicesDeps {
	repos: Repositories
	cache: Cache
	logger: Logger
	auth: AuthConfig
	bus: StreamBus
	openrouter?: OpenRouterClient
	useFakeAi?: boolean
}

export function createServices(deps: ServicesDeps): Services {
	const sessions = new SessionsService(deps.cache)
	const auth = new AuthService(deps.repos, sessions, deps.auth)

	let stories: StoryService

	const callbacks: AiCallbacks = {
		publish: (userId, event) => deps.bus.publish(userId, event),
		onAccepted: (storyId, result) => stories.applyAiAccepted(storyId, result),
		onRejected: (storyId, result) => stories.applyAiRejected(storyId, result),
		onFailed: (storyId, message) => stories.applyAiFailed(storyId, message),
	}

	const ai: AiProcessor = deps.useFakeAi
		? new FakeAiProcessor(callbacks)
		: new GeminiAiProcessor(deps.openrouter!, callbacks, deps.logger)

	// AI bot farm (skipped in fake-AI mode / when no model is configured)
	const bots = deps.openrouter
		? new BotService(deps.repos, deps.openrouter, deps.logger)
		: undefined

	stories = new StoryService(deps.repos, ai, bots)

	// NOTE: comment moderation via the streaming LLM hangs (plain-text reply
	// parsed as JSON never resolves), so use the passthrough moderator.
	const moderator = new PassthroughCommentModerator()

	const comments = new CommentService(deps.repos, moderator, bots)

	return { auth, sessions, stories, comments, bus: deps.bus, ai, bots }
}

export * from './ai'
export { AuthService } from './auth'
export { BotService } from './bots'
export { CommentService } from './comments'
export { SessionsService } from './sessions'
export { StoryService } from './stories'
export * from './stream-bus'
