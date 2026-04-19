import { getTestContext } from './setup'
import { afterAll } from 'bun:test'

const ctx = await getTestContext()

afterAll(async () => {
	await ctx.cleanup()
})
