import { BaseClient, type ClientConfig } from './base'
import { AuthResource } from './resources/auth'
import { CommentsResource } from './resources/comments'
import { HealthResource } from './resources/health'
import { StoriesResource } from './resources/stories'
import { StreamResource } from './resources/stream'
import { UsersResource } from './resources/users'

export class TellMeClient {
	readonly health: HealthResource
	readonly auth: AuthResource
	readonly stories: StoriesResource
	readonly comments: CommentsResource
	readonly users: UsersResource
	readonly stream: StreamResource

	constructor(config: ClientConfig) {
		const base = new BaseClient(config)
		this.health = new HealthResource(base)
		this.auth = new AuthResource(base)
		this.stories = new StoriesResource(base)
		this.comments = new CommentsResource(base)
		this.users = new UsersResource(base)
		this.stream = new StreamResource({
			baseUrl: config.baseUrl,
			getToken: config.getToken,
		})
	}
}

export { ApiError, type ClientConfig } from './base'
