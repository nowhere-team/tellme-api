// noinspection ES6PreferShortImport

import type { AiResponse } from '../../../src/services/ai'
import { FakeAiProcessor } from '../../../src/services/ai'
import type { AuthenticatedClient, TestContext } from './setup'

export function fakeAi(ctx: TestContext): FakeAiProcessor {
	if (!(ctx.app.services.ai instanceof FakeAiProcessor)) {
		throw new Error('test context is not using FakeAiProcessor')
	}
	return ctx.app.services.ai
}

export async function waitForStatus(
	ctx: TestContext,
	storyId: string,
	target: 'ready' | 'rejected' | 'published',
	timeoutMs = 2000,
): Promise<void> {
	const started = Date.now()
	while (Date.now() - started < timeoutMs) {
		const s = await ctx.app.services.stories.getRawById(storyId)
		if (s?.status === target) return
		await new Promise(r => setTimeout(r, 10))
	}
	throw new Error(`story ${storyId} did not reach status ${target} within ${timeoutMs}ms`)
}

export interface PublishOptions {
	raw?: string
	visibility?: 'open' | 'anonymous'
	aiResponse?: AiResponse
}

export async function createAndPublish(
	ctx: TestContext,
	auth: AuthenticatedClient,
	opts: PublishOptions = {},
) {
	const raw =
		opts.raw ?? 'Это длинный текст истории как минимум 50 символов, чтобы пройти валидацию схемы'

	if (opts.aiResponse) fakeAi(ctx).enqueue(opts.aiResponse)

	const { story } = await auth.client.stories.submit({
		raw,
		visibility: opts.visibility ?? 'open',
	})

	await waitForStatus(ctx, story.id, 'ready')
	const { story: published } = await auth.client.stories.publish(story.id)
	return published
}
