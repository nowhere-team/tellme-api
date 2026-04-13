export function sha256(input: string): string {
	const hasher = new Bun.CryptoHasher('sha256')
	hasher.update(input)
	return hasher.digest('hex')
}

export function sha256WithSalt(input: string, salt: string): string {
	const hasher = new Bun.CryptoHasher('sha256')
	hasher.update(salt + input)
	return hasher.digest('hex')
}

export function randomSalt(bytes = 16): string {
	const buf = new Uint8Array(bytes)
	crypto.getRandomValues(buf)
	return Buffer.from(buf).toString('hex')
}
