// rfc 6238 totp — using bun's crypto primitives

const DIGITS = 6
const PERIOD = 30
const ALGORITHM = 'sha1'

function base32Decode(encoded: string): Uint8Array {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
	const stripped = encoded.replace(/=+$/, '').toUpperCase()

	let bits = ''
	for (const char of stripped) {
		const val = alphabet.indexOf(char)
		if (val === -1) throw new Error('invalid base32 character')
		bits += val.toString(2).padStart(5, '0')
	}

	const bytes = new Uint8Array(Math.floor(bits.length / 8))
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2)
	}
	return bytes
}

function base32Encode(data: Uint8Array): string {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
	let bits = ''
	for (const byte of data) {
		bits += byte.toString(2).padStart(8, '0')
	}

	let result = ''
	for (let i = 0; i < bits.length; i += 5) {
		const chunk = bits.slice(i, i + 5).padEnd(5, '0')
		result += alphabet[parseInt(chunk, 2)]
	}
	return result
}

function hmacSha1(key: Uint8Array, data: Uint8Array): Uint8Array {
	const hasher = new Bun.CryptoHasher('sha1', key)
	hasher.update(data)
	return new Uint8Array(hasher.digest())
}

function generateCode(secret: Uint8Array, counter: bigint): string {
	const buf = new ArrayBuffer(8)
	const view = new DataView(buf)
	view.setBigUint64(0, counter)

	const hmac = hmacSha1(secret, new Uint8Array(buf))
	const offset = hmac[hmac.length - 1] & 0x0f
	const code =
		((hmac[offset] & 0x7f) << 24) |
		((hmac[offset + 1] & 0xff) << 16) |
		((hmac[offset + 2] & 0xff) << 8) |
		(hmac[offset + 3] & 0xff)

	return (code % 10 ** DIGITS).toString().padStart(DIGITS, '0')
}

export function generateTotpSecret(): string {
	const bytes = new Uint8Array(20)
	crypto.getRandomValues(bytes)
	return base32Encode(bytes)
}

export function verifyTotp(secret: string, code: string, window = 1): boolean {
	const key = base32Decode(secret)
	const now = BigInt(Math.floor(Date.now() / 1000 / PERIOD))

	for (let i = -window; i <= window; i++) {
		if (generateCode(key, now + BigInt(i)) === code) return true
	}
	return false
}

export function buildTotpUri(secret: string, username: string, issuer = 'Tellme'): string {
	return `otpauth://totp/${issuer}:${username}?secret=${secret}&issuer=${issuer}&algorithm=${ALGORITHM.toUpperCase()}&digits=${DIGITS}&period=${PERIOD}`
}
