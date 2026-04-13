import { BaseClient, type ClientConfig } from './base'
import { HealthResource } from './resources/health'

export class TellMeClient {
	readonly health: HealthResource

	constructor(config: ClientConfig) {
		const base = new BaseClient(config)
		this.health = new HealthResource(base)
	}
}

export { ApiError, type ClientConfig } from './base'
