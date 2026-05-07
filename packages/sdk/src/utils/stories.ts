// noinspection ES6PreferShortImport

import type { TextSegment, VoteOption } from '../types/domain'

const PLACEHOLDER_RE = /\{\{([^|{}]+)\|(\d+)\|(\d+)}}/g

// parses text with {{original|groupId|id}} placeholders.
// original names are NOT exposed — only replacement text is surfaced.
export function parsePlaceholders(
	text: string,
	replacements: Record<string, string>,
): TextSegment[] {
	const segments: TextSegment[] = []
	let lastIndex = 0

	for (const match of text.matchAll(PLACEHOLDER_RE)) {
		const [full, , groupIdStr, idStr] = match
		const start = match.index!

		if (start > lastIndex) {
			segments.push({ type: 'text', value: text.slice(lastIndex, start) })
		}

		const id = Number(idStr)
		segments.push({
			type: 'placeholder',
			groupId: Number(groupIdStr),
			id,
			replacement: replacements[String(id)] ?? '…',
		})

		lastIndex = start + full.length
	}

	if (lastIndex < text.length) {
		segments.push({ type: 'text', value: text.slice(lastIndex) })
	}

	return segments
}

export function totalVoteCount(options: VoteOption[]): number {
	return options.reduce((sum, o) => sum + o.voteCount, 0)
}

const STREAM_STATUS_LABELS: Record<string, Record<string, string>> = {
	ru: {
		title: 'Формулируем вопрос...',
		headline: 'Придумываем заголовок...',
		preview: 'Пишем анонс...',
		text: 'Обрабатываем историю...',
		replacements: 'Запоминаем имена...',
		category: 'Определяем категорию...',
		options: 'Подбираем варианты ответа...',
		warnings: 'Проверяем содержание...',
	},
	en: {
		title: 'Forming the question...',
		headline: 'Writing the headline...',
		preview: 'Writing the teaser...',
		text: 'Processing the story...',
		replacements: 'Anonymising names...',
		category: 'Assigning category...',
		options: 'Building vote options...',
		warnings: 'Checking content...',
	},
}

export function getStreamStatusLabel(key: string, locale = 'ru'): string {
	return STREAM_STATUS_LABELS[locale]?.[key] ?? STREAM_STATUS_LABELS['ru']?.[key] ?? '...'
}
