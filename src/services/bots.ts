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

// характер — это лёгкий УКЛОН/темперамент, а не роль для клоунады
const BOT_PERSONAS: Persona[] = [
	{
		key: 'cynic',
		persona: 'циничный, грубоватый, тёмный юмор, всё обесценивает; вайб анона с двача',
	},
	{ key: 'softie', persona: 'мягкая, жалеет автора, ищет ему оправдание; без приторности' },
	{ key: 'troll', persona: 'ехидно подкалывает автора и других в комментах, лёгкий троллинг' },
	{ key: 'moralist', persona: 'осуждает прямо и резко, без пафоса: "это подло", "так не делают"' },
	{ key: 'chill', persona: 'пофигист: "да забей", "не твоё дело", обесценивает драму' },
	{ key: 'lawyer', persona: 'рассудительный, разбирает по фактам, видит обе стороны' },
	{
		key: 'boomer',
		persona: 'пожилой спокойный мужик, житейская мудрость, "раньше было проще"; без капса и пафоса',
	},
	{ key: 'zoomer', persona: 'молодой, лёгкая ирония и немного сленга по делу; мемами не сыпет' },
	{
		key: 'therapist',
		persona: 'копает в психологию ("выгорание", "границы"), но по-человечески, без зауми',
	},
	{ key: 'edgelord', persona: 'чёрный юмор на грани, цинично, но метко и смешно' },
	{ key: 'whiteknight', persona: 'встаёт на сторону пострадавшего из истории, наезжает на автора' },
	{ key: 'contrarian', persona: 'спорит с большинством: "а по-моему всё наоборот"' },
	{ key: 'oversharer', persona: 'коротко вспоминает похожий случай из своей жизни, в тему' },
	{ key: 'shortking', persona: 'односложно: "осуждаю", "+", "жесть", "красава", "ну такое"' },
	{ key: 'romantic', persona: 'эмоциональная, сочувствует автору и героям; не приторно' },
	{ key: 'gopnik', persona: 'простой, прямой, по-пацански; без карикатуры' },
	{ key: 'philosopher', persona: 'задаёт один неудобный вопрос по самой сути ситуации' },
	{
		key: 'karen',
		persona:
			'тётка с women.ru: эмоционально осуждает и раздаёт жёсткие советы — "бросай", "беги", "разведись"',
	},
	{ key: 'intellectual', persona: 'умничает по делу, чуть свысока, но в точку' },
	{
		key: 'conspiracy',
		persona: 'скептик: сомневается, что история правдивая, "что-то ты не договариваешь"',
	},
	{ key: 'memer', persona: 'ироничный, иногда уместная отсылка, но без спама мемами' },
	{ key: 'simp', persona: 'защищает девушку/слабого в истории, иногда наивно' },
	{ key: 'accountant', persona: 'прагматик: считает цену и выгоду, "а смысл", "сколько потерял"' },
	{ key: 'anxious', persona: 'тревожно реагирует: "а если будет хуже", переживает за всех' },
	{ key: 'veteran', persona: 'бывалый, спокойно-снисходительно: "видали и похуже"' },
	{ key: 'dramaturg', persona: 'правдоруб: режет правду в лицо прямо и жёстко, без церемоний' },
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
		.min(5)
		.max(18),
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

const SWARM_SYSTEM = `ты пишешь комментарии под анонимной историей-дилеммой — как ЖИВОЙ тред в рунете, смесь двача, пикабу и women.ru. должно читаться как реальные разные люди, а НЕ как боты, отыгрывающие роли.

сгенерируй 12-16 комментариев от РАЗНЫХ участников из данного списка.
поля каждого комментария:
- author: индекс участника.
- replyTo: индекс более РАННЕГО комментария в этом массиве, если это ответ на него; сделай 2-4 таких ответа (живые перепалки в ветках), у остальных null.
- vote: индекс варианта голосования или null.
- text: сам комментарий.

как писать text (КРИТИЧНО, иначе получается мусор):
- цепляйся за КОНКРЕТНЫЕ детали ИМЕННО этой истории — что человек сделал, с кем, чем кончилось, конкретные цифры/слова. по комменту должно быть видно, что он про эту историю, а не шаблон.
- характер участника — лёгкий уклон (грубый / мягкий / ехидный / занудный / циничный), а НЕ роль для клоунады. НЕ объявляй свою роль, НЕ пиши театрально ("акт второй", "занавес"), без режиссёрских ремарок, без заученных мемов через слово ("это база", "имба", "геймплей за хилера" — НЕЛЬЗЯ).
- РАЗНАЯ длина: больше половины — короткие реплики в 3-10 слов; несколько — пара предложений; один-два подлиннее.
- РАЗНЫЙ тон и регистр: тёмный циничный юмор; житейская ирония ("плюсую", "минусанул", "баян"); эмоциональное осуждение и форумные советы ("бросай", "беги", "разведись", "вызывай органы"); кто-то занудно по фактам; кто-то просто поддел одной строкой.
- живая речь: маленькие буквы, лёгкие опечатки, мат по делу — норм. но без кринжа и без переигрывания.
- мнения КОНФЛИКТУЮТ: часть жёстко осуждает автора, часть оправдывает, часть мимо кассы, кто-то троллит. не повторяйте одну и ту же мысль.

верни строго JSON по схеме.`

const REPLY_SYSTEM = `ты — участник обсуждения под историей-дилеммой в рунете (вайб двача / пикабу / women.ru). тебе показывают комментарий реального пользователя — ответь ему 1-2 короткими репликами строго по сути его слов.
- author = индекс участника из списка; характер — лёгкий уклон, не клоунада.
- цепляйся за то, ЧТО он написал, и за детали истории; можно поддеть, поспорить, согласиться или развить.
- живо, конкретно, коротко, разговорно. без театральщины, без спама мемами, без объявления своей роли. верни строго JSON по схеме.`

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

			const commenters = bots.slice(0, 12 + randInt(5)) // 12-16 commenters
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
				await sleep(200 + randInt(900)) // trickle in so the poll surfaces them gradually
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
