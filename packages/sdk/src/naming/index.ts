import data from '@/data/dictionary.json' with { type: 'json' }
import { capitalize, pickCircular } from '@/utils'

export type Dictionary = typeof data
export type Language = keyof Dictionary
export const DICTIONARY = data as Dictionary

const FORMATTERS: Record<Language, (aIdx: number, nIdx: number) => string> = {
	ru: (aIdx, nIdx) => {
		const noun = pickCircular(DICTIONARY.ru.nouns, nIdx)
		const adjDict = pickCircular(DICTIONARY.ru.adjectives, aIdx)
		return `${capitalize(adjDict[noun.g as keyof typeof adjDict])}${capitalize(noun.v)}`
	},
	en: (aIdx, nIdx) => {
		const noun = pickCircular(DICTIONARY.en.nouns, nIdx)
		const adj = pickCircular(DICTIONARY.en.adjectives, aIdx)
		return `${capitalize(adj)}${capitalize(noun)}`
	},
}

// displayId format: "{aIdx}:{nIdx}:{discriminator}"
export function formatUsername(displayId: string, lang: Language = 'ru'): string {
	const parts = displayId.split(':')
	const aIdx = Number(parts[0]) || 0
	const nIdx = Number(parts[1]) || 0
	const disc = parts[2] !== undefined ? Number(parts[2]) : null

	const name = FORMATTERS[lang](aIdx, nIdx)
	return disc !== null && !Number.isNaN(disc) ? `${name}#${disc}` : name
}

export function parseDisplayId(displayId: string): {
	aIdx: number
	nIdx: number
	discriminator: number | null
} {
	const parts = displayId.split(':')
	return {
		aIdx: Number(parts[0]) || 0,
		nIdx: Number(parts[1]) || 0,
		discriminator: parts[2] !== undefined ? Number(parts[2]) : null,
	}
}

export function buildDisplayId(aIdx: number, nIdx: number, discriminator: number): string {
	return `${aIdx}:${nIdx}:${discriminator}`
}

// Reverse of formatUsername: turns a typed nick ("ТёплыйВетер#0") back into the
// candidate displayId(s) ("aIdx:nIdx:disc"). The surface form is an unseparated
// CamelCase concat of adjective+noun, so the split point is ambiguous — this
// returns every (adj, noun) pair that could produce it. Callers should try each
// candidate against storage and keep the one that maps to a real user.
// Matching is case-insensitive so the user need not reproduce the capitalisation.
export function resolveDisplayName(nick: string, lang: Language = 'ru'): string[] {
	const trimmed = nick.trim()
	const hashIdx = trimmed.lastIndexOf('#')
	if (hashIdx === -1) return []

	const disc = Number(trimmed.slice(hashIdx + 1))
	if (!Number.isInteger(disc) || disc < 0) return []
	const surface = trimmed.slice(0, hashIdx).toLowerCase()
	if (!surface) return []

	const { adjectives, nouns } = DICTIONARY[lang]
	const candidates: string[] = []

	for (let nIdx = 0; nIdx < nouns.length; nIdx++) {
		const noun = nouns[nIdx]
		const nounWord = (typeof noun === 'string' ? noun : noun.v).toLowerCase()
		// the adjective always precedes the noun, so a real prefix must remain
		if (surface.length <= nounWord.length || !surface.endsWith(nounWord)) continue

		const prefix = surface.slice(0, surface.length - nounWord.length)
		for (let aIdx = 0; aIdx < adjectives.length; aIdx++) {
			const adj = adjectives[aIdx]
			const adjForm =
				typeof adj === 'string' ? adj : adj[(noun as { g: string }).g as keyof typeof adj]
			if (adjForm.toLowerCase() === prefix) candidates.push(buildDisplayId(aIdx, nIdx, disc))
		}
	}

	return candidates
}
