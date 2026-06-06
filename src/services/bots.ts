import { randomBytes } from 'node:crypto'
import { z } from 'zod'

import { hashPassword } from '@/common/crypto'
import type { Logger } from '@/platform/logger'
import type { OpenRouterClient } from '@/platform/openrouter'
import type { Repositories } from '@/repositories'
import type { DbComment } from '@/repositories/comments'
import type { DbVoteOption } from '@/repositories/stories'
import type { DbUser } from '@/repositories/users'

import { PLACEHOLDER_RE } from './ai/schema'

// --- personas: distinct characters so the farm feels like a real crowd ---
interface Persona {
	key: string
	persona: string
}

const BOT_PERSONAS: Persona[] = [
	{
		key: 'cynic',
		persona:
			'Циник: желчный, во всём видит худшее, уверен, что все врут и манипулируют, обесценивает чужую боль.',
	},
	{
		key: 'softie',
		persona:
			'Сочувствующий: мягкий, всегда находит автору оправдание, жалеет, "ты не виноват, обстоятельства".',
	},
	{
		key: 'troll',
		persona: 'Тролль: провоцирует, ехидный сарказм, специально подкалывает и раздувает драму.',
	},
	{
		key: 'moralist',
		persona: 'Моралист: строго осуждает с позиции морали, "так нельзя", немного пафосно и свысока.',
	},
	{
		key: 'chill',
		persona: 'Пофигист: "да забей", обесценивает проблему, "это вообще не дилемма, забудь".',
	},
	{
		key: 'lawyer',
		persona:
			'Адвокат дьявола: рассудительный, "с одной стороны... с другой стороны", взвешивает обе позиции.',
	},
	{
		key: 'boomer',
		persona:
			'Бумер: пишет как пожилой человек, осуждает молодёжь, "вот в наше время", иногда срывается на КАПС.',
	},
	{
		key: 'zoomer',
		persona:
			'Зумер: сленг и мемы, "база", "скуф", "кринж", "реал", "ну такое", маленькими буквами, лол.',
	},
	{
		key: 'therapist',
		persona:
			'Псевдопсихолог: "тебе надо это проработать", "выгорание", "токсично", "поставь границы", умные слова.',
	},
	{
		key: 'edgelord',
		persona: 'Эджлорд: чёрный юмор, цинично шутит даже про тяжёлое, провокационно, но смешно.',
	},
	{
		key: 'whiteknight',
		persona:
			'Защитник: агрессивно встаёт на сторону пострадавшего из истории и нападает на автора.',
	},
	{
		key: 'contrarian',
		persona:
			'Спорщик: специально занимает позицию против большинства, любит поспорить и доказать обратное.',
	},
	{
		key: 'oversharer',
		persona:
			'Душнила-рассказчик: в ответ начинает рассказывать свою "похожую историю" и уводит тему на себя.',
	},
	{
		key: 'shortking',
		persona:
			'Односложный: отвечает максимально коротко — "осуждаю.", "+", "жесть", "ну такое", "красава".',
	},
	{
		key: 'romantic',
		persona:
			'Сентиментальный: всё переводит в чувства, "это так грустно...", эмоционально, с многоточиями.',
	},
]

const PERSONA_BY_KEY = new Map(BOT_PERSONAS.map(p => [p.key, p.persona]))

// --- LLM response schemas ---
const swarmSchema = z.object({
	comments: z
		.array(
			z.object({
				author: z.number().int(),
				replyTo: z.number().int().nullable(),
				vote: z.number().int().nullable(),
				text: z.string().min(1).max(400),
			}),
		)
		.min(3)
		.max(9),
})

const replySchema = z.object({
	replies: z
		.array(z.object({ author: z.number().int(), text: z.string().min(1).max(400) }))
		.min(1)
		.max(2),
})

const toJson = (s: z.ZodType) => z.toJSONSchema(s, { target: 'draft-7', unrepresentable: 'any' })
let swarmJson: object | undefined
let replyJson: object | undefined
function swarmJsonSchema(): object {
	if (!swarmJson) swarmJson = toJson(swarmSchema)
	return swarmJson
}
function replyJsonSchema(): object {
	if (!replyJson) replyJson = toJson(replySchema)
	return replyJson
}

const SWARM_SYSTEM = `ты генерируешь комментарии сообщества под анонимной историей-дилеммой (формат "осудите меня").
тебе дан список УЧАСТНИКОВ, у каждого свой характер. сгенерируй 4-8 коротких комментариев, каждый СТРОГО в характере своего участника.
- author: индекс участника из списка.
- replyTo: индекс БОЛЕЕ РАННЕГО комментария в этом же массиве, если это ответ на него (споры в ветках), иначе null. делай 1-3 ответа-реплики между участниками.
- vote: индекс варианта голосования, за который этот участник голосует, или null.
- text: живой разговорный рунет, коротко, по делу, в характере. без морализаторства от себя, без хэштегов, маленькие буквы ок.
мнения должны РАЗЛИЧАТЬСЯ: кто-то осуждает, кто-то оправдывает, кто-то троллит, кто-то спорит. верни строго JSON по схеме.`

const REPLY_SYSTEM = `ты — участник обсуждения под историей-дилеммой, у тебя есть характер. тебе показывают комментарий реального пользователя.
ответь ему 1-2 короткими репликами строго в характере участника(ов) из списка (author = индекс участника). живой разговорный рунет, можно спорить, поддеть, согласиться или развить мысль. реагируй именно на его слова. верни строго JSON по схеме.`

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const randInt = (n: number) => Math.floor(Math.random() * n)
const shuffle = <T>(a: T[]): T[] =>
	a
		.map(v => [Math.random(), v] as const)
		.sort((x, y) => x[0] - y[0])
		.map(p => p[1])

function renderText(text: string | null, replacements: Record<string, string> | null): string {
	if (!text) return ''
	return text.replace(PLACEHOLDER_RE, (_m, _orig, _gid, id) => replacements?.[id] ?? 'человек')
}

export class BotService {
	constructor(
		private readonly repos: Repositories,
		private readonly openrouter: OpenRouterClient,
		private readonly logger: Logger,
	) {}

	// Idempotent: create any missing bot accounts so the farm is fully staffed.
	async ensureBots(): Promise<void> {
		try {
			const existing = await this.repos.users.findBots()
			const have = new Set(existing.map(b => b.botPersona))
			for (const p of BOT_PERSONAS) {
				if (have.has(p.key)) continue
				await this.repos.users.create({
					passwordHash: await hashPassword(randomBytes(18).toString('base64url')),
					totpSecret: null,
					recoveryHash: randomBytes(32).toString('hex'),
					botPersona: p.key,
				})
			}
			this.logger.info('bots ensured', { total: BOT_PERSONAS.length })
		} catch (err) {
			this.logger.error('ensureBots failed', err as Error)
		}
	}

	// Fire-and-forget: a crowd of bots comments + votes on a freshly published story.
	async swarmStory(storyId: string): Promise<void> {
		try {
			const detail = await this.repos.stories.findByIdWithOptions(storyId)
			if (!detail || detail.status !== 'published') return

			const bots = shuffle(await this.repos.users.findBots())
			if (bots.length === 0) return

			const commenters = bots.slice(0, 4 + randInt(4)) // 4-7 commenters
			const out = await this.generate(
				swarmSchema,
				swarmJsonSchema(),
				SWARM_SYSTEM,
				[
					`ИСТОРИЯ:\n${detail.title ?? ''}\n\n${renderText(detail.text, detail.replacements)}`,
					`ВАРИАНТЫ ГОЛОСОВАНИЯ:\n${detail.options.map((o, i) => `${i}: ${o.label}`).join('\n')}`,
					`УЧАСТНИКИ (отвечай строго в их характере):\n${commenters.map((b, i) => `${i}: ${this.persona(b)}`).join('\n')}`,
				].join('\n\n'),
			)
			if (!out) return

			const createdIds: (string | null)[] = []
			for (let i = 0; i < out.comments.length; i++) {
				const c = out.comments[i]
				const bot =
					commenters[((c.author % commenters.length) + commenters.length) % commenters.length]
				const parentId =
					c.replyTo != null && c.replyTo >= 0 && c.replyTo < i ? createdIds[c.replyTo] : null
				createdIds.push(await this.postComment(storyId, bot.id, parentId, c.text))
				this.castVote(storyId, bot.id, detail.options, c.vote)
				await sleep(400 + randInt(1800)) // trickle in so the poll surfaces them gradually
			}

			// a few extra silent voters so votes outnumber comments, like a real feed
			for (const b of bots.slice(commenters.length, commenters.length + 2 + randInt(4))) {
				this.castVote(storyId, b.id, detail.options, randInt(detail.options.length))
			}
		} catch (err) {
			this.logger.error('bot swarm failed', err as Error)
		}
	}

	// Fire-and-forget: bots reply to a real user's comment so threads feel alive.
	async replyToComment(storyId: string, comment: DbComment): Promise<void> {
		try {
			const detail = await this.repos.stories.findByIdWithOptions(storyId)
			if (!detail || detail.status !== 'published') return

			const bots = shuffle(await this.repos.users.findBots())
			if (bots.length === 0) return
			const repliers = bots.slice(0, 1 + randInt(2)) // 1-2 repliers

			let parentText = ''
			if (comment.parentId) {
				const p = await this.repos.comments.findById(comment.parentId)
				if (p) parentText = p.content
			}

			const out = await this.generate(
				replySchema,
				replyJsonSchema(),
				REPLY_SYSTEM,
				[
					`ИСТОРИЯ: ${detail.title ?? ''}\n${renderText(detail.text, detail.replacements).slice(0, 600)}`,
					parentText ? `ВЫШЕ В ВЕТКЕ: ${parentText}` : '',
					`КОММЕНТ ПОЛЬЗОВАТЕЛЯ (ответь именно на него): ${comment.content}`,
					`УЧАСТНИКИ:\n${repliers.map((b, i) => `${i}: ${this.persona(b)}`).join('\n')}`,
				]
					.filter(Boolean)
					.join('\n\n'),
			)
			if (!out) return

			for (const r of out.replies) {
				const bot = repliers[((r.author % repliers.length) + repliers.length) % repliers.length]
				await this.postComment(storyId, bot.id, comment.id, r.text)
				await sleep(900 + randInt(2600))
			}
		} catch (err) {
			this.logger.error('bot reply failed', err as Error)
		}
	}

	private persona(bot: DbUser): string {
		return (bot.botPersona && PERSONA_BY_KEY.get(bot.botPersona)) || 'обычный участник сообщества'
	}

	private async postComment(
		storyId: string,
		botId: string,
		parentId: string | null,
		text: string,
	): Promise<string | null> {
		try {
			const c = await this.repos.comments.create({
				storyId,
				authorId: botId,
				parentId: parentId ?? null,
				content: text.slice(0, 2000),
			})
			return c.id
		} catch {
			return null
		}
	}

	private castVote(
		storyId: string,
		botId: string,
		options: DbVoteOption[],
		index: number | null,
	): void {
		if (index == null || !options[index]) return
		// fire-and-forget; swallow "already voted" and other conflicts
		void this.repos.votes.cast(storyId, botId, options[index].id).catch(() => {})
	}

	private async generate<T>(
		schema: z.ZodType<T>,
		jsonSchema: object,
		system: string,
		user: string,
	): Promise<T | null> {
		try {
			const { chunks, final } = this.openrouter.generateStream<unknown>({
				system,
				user,
				schema: jsonSchema,
				temperature: 1.0,
				paths: ['$'],
			})
			// the stream generator only runs while chunks is consumed; draining it
			// drives the request to completion and resolves `final`
			for await (const _ of chunks) {
				// discard incremental chunks; we only want the final object
			}
			return schema.parse(await final)
		} catch (err) {
			this.logger.error('bot generation failed', err as Error)
			return null
		}
	}
}
