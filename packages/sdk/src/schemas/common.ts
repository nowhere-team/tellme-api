import { z } from 'zod'

export const uuid = z.uuid()

export const pagination = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(20),
	cursor: z.string().optional(),
})
