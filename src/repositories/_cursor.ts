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
