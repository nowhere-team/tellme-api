export class AsyncQueue<T> {
	private readonly items: T[] = []
	private wake: (() => void) | null = null
	private closed = false

	push(item: T): void {
		this.items.push(item)
		this.notify()
	}

	close(): void {
		this.closed = true
		this.notify()
	}

	async *drain(): AsyncGenerator<T> {
		while (!this.closed || this.items.length > 0) {
			if (this.items.length === 0) {
				await new Promise<void>(resolve => {
					this.wake = resolve
				})
			}
			while (this.items.length > 0) yield this.items.shift()!
		}
	}

	private notify(): void {
		if (!this.wake) return
		const w = this.wake
		this.wake = null
		w()
	}
}
