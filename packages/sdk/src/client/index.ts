import { BaseClient, type ClientConfig } from './base'
import { AuthResource } from './resources/auth'
import { HealthResource } from './resources/health'
import { StoriesResource } from './resources/stories'
import { StreamResource } from './resources/stream'

export class TellMeClient {
	readonly health: HealthResource
	readonly auth: AuthResource
	readonly stories: StoriesResource
	readonly stream: StreamResource

	constructor(config: ClientConfig) {
		const base = new BaseClient(config)
		this.health = new HealthResource(base)
		this.auth = new AuthResource(base)
		this.stories = new StoriesResource(base)
		this.stream = new StreamResource({
			baseUrl: config.baseUrl,
			getToken: config.getToken,
		})
	}
}

export { ApiError, type ClientConfig } from './base'
