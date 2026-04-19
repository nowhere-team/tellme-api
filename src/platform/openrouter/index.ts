import type { Logger } from '@/platform/logger'

import { OpenRouterClient } from './client'
import type { OpenRouterConfig } from './types'

export function createOpenRouter(config: OpenRouterConfig, logger: Logger) {
	return new OpenRouterClient(config, logger)
}

export * from './async-queue'
export * from './stream-parser'
export * from './types'
export { OpenRouterClient }
