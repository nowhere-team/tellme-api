import { generateMnemonic as bip39Generate, mnemonicToSeed, validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'

const STRENGTH_MAP = {
	12: 128,
	15: 160,
	18: 192,
	21: 224,
	24: 256,
} as const

export type MnemonicWordCount = keyof typeof STRENGTH_MAP

export function generateMnemonic(wordCount: MnemonicWordCount = 12): string {
	return bip39Generate(wordlist, STRENGTH_MAP[wordCount])
}

export function validateMnemonicPhrase(mnemonic: string): boolean {
	return validateMnemonic(mnemonic, wordlist)
}

export async function mnemonicToSeedBytes(
	mnemonic: string,
	passphrase?: string,
): Promise<Uint8Array> {
	return mnemonicToSeed(mnemonic, passphrase)
}

export function mnemonicToHash(mnemonic: string): string {
	const hasher = new Bun.CryptoHasher('sha256')
	hasher.update(mnemonic.trim().toLowerCase())
	return hasher.digest('hex')
}
