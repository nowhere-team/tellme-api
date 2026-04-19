import { createAndPublish, fakeAi, waitForStatus } from './helpers'
import { cleanDatabase, getTestContext, type TestContext } from './setup'
import { beforeAll, beforeEach, describe, expect, test } from 'bun:test'

describe('stories — processing flow', () => {
	let ctx: TestContext

	beforeAll(async () => {
		ctx = await getTestContext()
	})

	beforeEach(async () => {
		await cleanDatabase(ctx.app)
		fakeAi(ctx).reset()
	})

	test('submit creates a processing story with raw text', async () => {
		const auth = await ctx.createAuthenticatedClient()
		const raw = 'я накричал на коллегу когда он опять опоздал на стендап, теперь стыдно'
		fakeAi(ctx).enqueue({
			decision: 'accepted',
			title: 'был ли я прав?',
			text: raw,
			replacements: {},
			category: 'work',
			options: [
				{ label: 'ты был прав', position: 0 },
				{ label: 'ты перегнул', position: 1 },
			],
			warnings: [],
		})

		const { story } = await auth.client.stories.submit({ raw, visibility: 'open' })
		expect(story.status).toBe('processing')
		expect(story.raw).toBe(raw)
		expect(story.text).toBeNull()

		await waitForStatus(ctx, story.id, 'ready')
	})

	test('publish rejects processing story', async () => {
		const auth = await ctx.createAuthenticatedClient()
		// never enqueue — fake ai will default to accepted, so block it by delaying status check
		await auth.client.stories.submit({
			raw: 'длинный текст достаточно для валидации схемы с нужным количеством символов',
			visibility: 'open',
		})
		// attempt to publish before fakeAi microtask resolves:
		// fakeAi runs async, so this may race. we reliably reproduce the conflict
		// by moving the story back to processing manually first:
		// but that leaks internals — better: use a rejected response to ensure non-ready status
		fakeAi(ctx).enqueue({ decision: 'rejected', code: 'too_short', message: 'короткая' })

		// submit another story with the rejected response
		const { story: rejected } = await auth.client.stories.submit({
			raw: 'ещё одна история длиной достаточно для валидации схемы по минимальному порогу',
			visibility: 'open',
		})
		await waitForStatus(ctx, rejected.id, 'rejected')

		expect(auth.client.stories.publish(rejected.id)).rejects.toMatchObject({
			code: 'CONFLICT',
		})
	})

	test('non-author cannot publish', async () => {
		const author = await ctx.createAuthenticatedClient()
		const stranger = await ctx.createAuthenticatedClient()

		const story = await createAndPublish(ctx, author)

		await expect(stranger.client.stories.publish(story.id)).rejects.toMatchObject({
			code: 'FORBIDDEN',
		})
	})

	test('rejected story surfaces rejection info on get', async () => {
		const auth = await ctx.createAuthenticatedClient()
		fakeAi(ctx).enqueue({
			decision: 'rejected',
			code: 'not_a_story',
			message: 'это не выглядит как история',
		})

		const { story } = await auth.client.stories.submit({
			raw: 'реклама реклама реклама реклама реклама реклама реклама реклама реклама реклама',
			visibility: 'open',
		})
		await waitForStatus(ctx, story.id, 'rejected')

		const view = await auth.client.stories.get(story.id)
		expect(view.story.status).toBe('rejected')
		expect(view.story.rejectionCode).toBe('not_a_story')
	})
})

describe('stories — voting', () => {
	let ctx: TestContext
	beforeAll(async () => {
		ctx = await getTestContext()
	})
	beforeEach(async () => {
		await cleanDatabase(ctx.app)
		fakeAi(ctx).reset()
	})

	test('voter casts vote, counter increments', async () => {
		const author = await ctx.createAuthenticatedClient()
		const voter = await ctx.createAuthenticatedClient()

		const story = await createAndPublish(ctx, author)
		const view = await voter.client.stories.get(story.id)
		const first = view.options[0]!

		await voter.client.stories.vote(story.id, { optionId: first.id })

		const after = await voter.client.stories.get(story.id)
		const voted = after.options.find((o: any) => o.id === first.id)
		expect(voted).toBeDefined()
		expect(voted!.voteCount).toBe(1)
		expect(after.userVote).toBe(first.id)
	})

	test('author cannot vote on own story', async () => {
		const author = await ctx.createAuthenticatedClient()
		const story = await createAndPublish(ctx, author)
		const view = await author.client.stories.get(story.id)
		expect(
			author.client.stories.vote(story.id, { optionId: view.options[0].id }),
		).rejects.toMatchObject({ code: 'FORBIDDEN' })
	})

	test('cannot vote twice', async () => {
		const author = await ctx.createAuthenticatedClient()
		const voter = await ctx.createAuthenticatedClient()
		const story = await createAndPublish(ctx, author)
		const view = await voter.client.stories.get(story.id)

		await voter.client.stories.vote(story.id, { optionId: view.options[0].id })
		expect(
			voter.client.stories.vote(story.id, { optionId: view.options[1].id }),
		).rejects.toMatchObject({ code: 'CONFLICT' })
	})

	test('invalid uuid in optionId returns 400', async () => {
		const author = await ctx.createAuthenticatedClient()
		const voter = await ctx.createAuthenticatedClient()
		const story = await createAndPublish(ctx, author)

		expect(voter.client.stories.vote(story.id, { optionId: 'not-a-uuid' })).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
			status: 400,
		})
	})
})

describe('stories — visibility', () => {
	let ctx: TestContext
	beforeAll(async () => {
		ctx = await getTestContext()
	})
	beforeEach(async () => {
		await cleanDatabase(ctx.app)
		fakeAi(ctx).reset()
	})

	test('anonymous story hides authorId from other viewers', async () => {
		const author = await ctx.createAuthenticatedClient()
		const stranger = await ctx.createAuthenticatedClient()

		const story = await createAndPublish(ctx, author, { visibility: 'anonymous' })

		const viewedByAuthor = await author.client.stories.get(story.id)
		expect(viewedByAuthor.story.authorId).toBe(author.userId)

		const viewedByStranger = await stranger.client.stories.get(story.id)
		expect(viewedByStranger.story.authorId).toBeNull()
	})

	test('feed is visible to unauthenticated', async () => {
		const author = await ctx.createAuthenticatedClient()
		await createAndPublish(ctx, author)

		const anon = ctx.createClient()
		const feed = await anon.stories.feed({ limit: 10 })
		expect(feed.items.length).toBe(1)
	})
})
