import type { Cache } from '@/platform/cache'
import type { Logger } from '@/platform/logger'
import type { OpenRouterClient } from '@/platform/openrouter'
import type { Repositories } from '@/repositories'

import { type AiCallbacks, type AiProcessor, FakeAiProcessor, GeminiAiProcessor } from './ai'
import { type AuthConfig, AuthService } from './auth'
import { SessionsService } from './sessions'
import { StoryService } from './stories'
import type { StreamBus } from './stream-bus'

export interface Services {
	auth: AuthService
	sessions: SessionsService
	stories: StoryService
	bus: StreamBus
	ai: AiProcessor
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

	// stories + ai have a circular-ish dependency (ai calls back into stories).
	// break it with a forward reference.
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

	stories = new StoryService(deps.repos, ai)

	return { auth, sessions, stories, bus: deps.bus, ai }
}

export * from './ai'
export { AuthService } from './auth'
export { SessionsService } from './sessions'
export { StoryService } from './stories'
export * from './stream-bus'
