import type { StreamEvent } from '@nowhere-team/tellme-sdk'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

import { AppError } from '@/common/errors'
import type { AuthEnv } from '@/http/middleware/auth'
import type { StreamBus } from '@/services'

export function createStreamRoutes(bus: StreamBus) {
	const app = new Hono<AuthEnv>()

	app.get('/', async c => {
		const auth = c.get('auth')
		if (!auth) throw AppError.forbidden('authentication required')

		return streamSSE(c, async send => {
			const queue: StreamEvent[] = []
			let wake: (() => void) | null = null
			let aborted = false

			const unsubscribe = bus.subscribe(auth.sub, event => {
				queue.push(event)
				if (wake) {
					const w = wake
					wake = null
					w()
				}
			})

			c.req.raw.signal?.addEventListener('abort', () => {
				aborted = true
				unsubscribe()
				if (wake) {
					const w = wake
					wake = null
					w()
				}
			})

			// keep-alive comment every 20s so proxies don't kill the connection
			const keepalive = setInterval(() => {
				send.writeSSE({ data: '', event: 'ping' }).catch(() => {})
			}, 20_000)

			try {
				while (!aborted) {
					if (queue.length === 0) {
						await new Promise<void>(r => {
							wake = r
						})
					}
					while (queue.length > 0) {
						const event = queue.shift()!
						await send.writeSSE({
							event: event.type,
							data: JSON.stringify(event),
						})
					}
				}
			} finally {
				clearInterval(keepalive)
				unsubscribe()
			}
		})
	})

	return app
}
