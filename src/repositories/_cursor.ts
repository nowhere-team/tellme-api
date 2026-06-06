export interface Cursor {
	date: Date
	id: string
}

export function encodeCursor(date: Date, id: string): string {
	return Buffer.from(`${date.getTime()}:${id}`).toString('base64url')
}

export function decodeCursor(raw: string): Cursor | null {
	try {
		const s = Buffer.from(raw, 'base64url').toString('utf8')
		const sep = s.indexOf(':')
		if (sep === -1) return null
		const ts = parseInt(s.slice(0, sep), 10)
		const id = s.slice(sep + 1)
		if (Number.isNaN(ts) || !id) return null
		return { date: new Date(ts), id }
	} catch {
		return null
	}
}

// Feed cursor carries the sort mode plus a numeric sort key and id, so the
// "hot" feed can paginate by its (time-decayed) score and "new" by publish time
// consistently with its ORDER BY. Mode is embedded so a cursor from one sort is
// ignored when the sort changes.
export interface FeedCursor {
	sort: 'hot' | 'new'
	key: number
	id: string
}

export function encodeFeedCursor(sort: 'hot' | 'new', key: number, id: string): string {
	return Buffer.from(`${sort}:${key}:${id}`).toString('base64url')
}

export function decodeFeedCursor(raw: string): FeedCursor | null {
	try {
		const s = Buffer.from(raw, 'base64url').toString('utf8')
		const a = s.indexOf(':')
		const b = s.indexOf(':', a + 1)
		if (a === -1 || b === -1) return null
		const sort = s.slice(0, a)
		const key = Number(s.slice(a + 1, b))
		const id = s.slice(b + 1)
		if ((sort !== 'hot' && sort !== 'new') || Number.isNaN(key) || !id) return null
		return { sort, key, id }
	} catch {
		return null
	}
}
