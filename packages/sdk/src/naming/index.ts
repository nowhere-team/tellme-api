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
