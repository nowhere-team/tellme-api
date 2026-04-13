import { PinoLogger } from './pino'
import type { Logger, LoggerConfig } from './types'

export function createLogger(config: LoggerConfig): Logger {
	return new PinoLogger(config)
}

export * from './types'
