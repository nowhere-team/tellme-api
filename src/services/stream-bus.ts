import type { StreamEvent } from '@nowhere-team/tellme-sdk'
import { RedisClient } from 'bun'

import type { Logger } from '@/platform/logger'

export type StreamListener = (event: StreamEvent) => void

export interface StreamBus {
	subscribe(userId: string, listener: StreamListener): () => void
	publish(userId: string, event: StreamEvent): void
	connect(): Promise<void>
	disconnect(): Promise<void>
}

export class InProcessStreamBus implements StreamBus {
	private readonly listeners = new Map<string, Set<StreamListener>>()

	async connect(): Promise<void> {}

	async disconnect(): Promise<void> {
		this.listeners.clear()
	}

	subscribe(userId: string, listener: StreamListener): () => void {
		const set = this.listeners.get(userId) ?? new Set<StreamListener>()
		set.add(listener)
		this.listeners.set(userId, set)
		return () => {
			set.delete(listener)
			if (set.size === 0) this.listeners.delete(userId)
		}
	}

	publish(userId: string, event: StreamEvent): void {
		const set = this.listeners.get(userId)
		if (!set) return
		for (const l of set) {
			try {
				l(event)
			} catch {
				// isolated — a faulty listener must not break others
			}
		}
	}
}

interface RedisStreamEnvelope {
	userId: string
	event: StreamEvent
}

export class RedisStreamBus implements StreamBus {
	private readonly local = new InProcessStreamBus()
	private readonly subscriber: RedisClient
	private readonly publisher: RedisClient
	private readonly channel: string
	private connected = false

	constructor(
		url: string,
		prefix: string,
		private readonly logger: Logger,
	) {
		this.channel = `${prefix}stream`
		this.subscriber = new RedisClient(url)
		this.publisher = new RedisClient(url)
	}

	async connect(): Promise<void> {
		if (this.connected) return
		await this.publisher.connect()
		await this.subscriber.connect()
		await this.subscriber.subscribe(this.channel, (raw: string) => {
			this.onMessage(raw)
		})
		this.connected = true
	}

	async disconnect(): Promise<void> {
		if (!this.connected) return
		try {
			await this.subscriber.unsubscribe(this.channel)
		} catch {}
		this.subscriber.close()
		this.publisher.close()
		this.connected = false
	}

	subscribe(userId: string, listener: StreamListener): () => void {
		return this.local.subscribe(userId, listener)
	}

	publish(userId: string, event: StreamEvent): void {
		const payload: RedisStreamEnvelope = { userId, event }
		this.publisher
			.publish(this.channel, JSON.stringify(payload))
			.catch(err => this.logger.error('stream publish failed', err as Error))
	}

	private onMessage(raw: string): void {
		try {
			const envelope = JSON.parse(raw) as RedisStreamEnvelope
			this.local.publish(envelope.userId, envelope.event)
		} catch (err) {
			this.logger.warn('failed to parse stream envelope', { err })
		}
	}
}
