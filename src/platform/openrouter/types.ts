export interface OpenRouterConfig {
	apiKey: string
	baseUrl?: string
	model: string
}

export interface UsageStats {
	promptTokens: number
	completionTokens: number
	totalTokens: number
	generationId?: string
}

export interface GenerateParams {
	system: string
	user: string
	schema?: object
	temperature?: number
	signal?: AbortSignal
}

export interface StreamChunk {
	key: string
	value: unknown
}

export interface StreamResult<T> {
	chunks: AsyncIterable<StreamChunk>
	final: Promise<T>
	usage: Promise<UsageStats | undefined>
}
