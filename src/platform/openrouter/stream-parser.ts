import { JSONParser } from '@streamparser/json'

import type { StreamChunk } from './types'

export class StreamParser<T> {
	private readonly partial: JSONParser
	private readonly full: JSONParser
	private final: T | undefined

	constructor(paths: string[], onChunk: (chunk: StreamChunk) => void) {
		this.partial = new JSONParser({ paths, keepStack: false, emitPartialValues: false })
		this.full = new JSONParser({ paths: ['$'], keepStack: true, emitPartialValues: false })

		this.partial.onValue = ({ value, key }) => {
			// noinspection SuspiciousTypeOfGuard
			if (key === undefined || typeof key === 'symbol') return
			onChunk({ key: String(key), value })
		}
		this.full.onValue = ({ value }) => {
			this.final = value as T
		}
	}

	write(chunk: string): void {
		if (!chunk) return
		this.partial.write(chunk)
		this.full.write(chunk)
	}

	getFinal(): T | undefined {
		return this.final
	}
}
