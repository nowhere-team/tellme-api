import { CATEGORIES, REJECTIONS, WARNINGS } from '@nowhere-team/tellme-sdk'
import { z } from 'zod'

// placeholder regex for validation:
// {{original|groupId|id}}
// - original: any non-empty chars except `|`, `{`, `}`
// - groupId: positive integer
// - id: positive integer (must match a key in replacements)
export const PLACEHOLDER_RE = /\{\{([^|{}]+)\|(\d+)\|(\d+)}}/g

// Repairs the model's name placeholders so a single inconsistency never kills a
// story: keeps only replacements actually referenced in the text, and fills any
// placeholder missing a replacement — reusing another replacement from the same
// person (group) when possible, otherwise a neutral fallback. Always returns a
// consistent (text, replacements) pair.
export function sanitizePlaceholders(
	text: string,
	replacements: Record<string, string>,
): { text: string; replacements: Record<string, string> } {
	const idToGroup = new Map<string, string>()
	const usedIds = new Set<string>()
	for (const m of text.matchAll(PLACEHOLDER_RE)) {
		usedIds.add(m[3]!)
		idToGroup.set(m[3]!, m[2]!)
	}

	const out: Record<string, string> = {}
	for (const id of usedIds) {
		if (replacements[id]) {
			out[id] = replacements[id]
			continue
		}
		const group = idToGroup.get(id)
		let fallback: string | undefined
		for (const [rid, val] of Object.entries(replacements)) {
			if (val && idToGroup.get(rid) === group) {
				fallback = val
				break
			}
		}
		out[id] = fallback ?? 'человек'
	}

	return { text, replacements: out }
}

const voteOption = z.object({
	label: z.string().min(1).max(40),
	position: z.number().int().min(0).max(3),
})

export const aiAcceptedSchema = z.object({
	decision: z.literal('accepted'),
	headline: z.string().min(5).max(80),
	title: z.string().min(5).max(120),
	preview: z.string().min(20).max(400), // new: 2-3 sentence story hook
	text: z.string().min(50).max(7000),
	replacements: z.record(z.string().regex(/^\d+$/), z.string().min(1).max(120)),
	category: z.enum(CATEGORIES),
	options: z.array(voteOption).min(2).max(4),
	warnings: z.array(z.enum(WARNINGS)),
})

export const aiRejectedSchema = z.object({
	decision: z.literal('rejected'),
	code: z.enum(REJECTIONS),
	message: z.string().min(3).max(300),
})

export const aiResponseSchema = z.discriminatedUnion('decision', [
	aiAcceptedSchema,
	aiRejectedSchema,
])

export type AiAccepted = z.infer<typeof aiAcceptedSchema>
export type AiRejected = z.infer<typeof aiRejectedSchema>
export type AiResponse = z.infer<typeof aiResponseSchema>

let cached: object | null = null
export function getAiJsonSchema(): object {
	if (!cached) {
		cached = z.toJSONSchema(aiResponseSchema, { target: 'draft-7', unrepresentable: 'any' })
	}
	return cached
}

// ensure every placeholder in text points to a valid replacement id,
// and every replacement is referenced. throws on invalid.
export function validatePlaceholders(text: string, replacements: Record<string, string>): void {
	const ids = new Set<string>()
	for (const match of text.matchAll(PLACEHOLDER_RE)) {
		const id = match[3]!
		ids.add(id)
		if (!(id in replacements)) {
			throw new Error(`placeholder id ${id} has no replacement`)
		}
	}
	for (const id of Object.keys(replacements)) {
		if (!ids.has(id)) {
			throw new Error(`replacement ${id} is not referenced in text`)
		}
	}
}
