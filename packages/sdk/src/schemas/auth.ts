import { z } from 'zod'

export const register = z.object({
	password: z.string().min(8).max(200),
	locale: z.enum(['ru', 'en']).optional(),
	enableTotp: z.boolean().optional(),
})

export const login = z.object({
	username: z.string().min(1),
	password: z.string().min(1),
	totpCode: z.string().optional(),
})

export const recover = z.object({
	mnemonic: z.string().min(1),
	newPassword: z.string().min(8).max(200),
})

export type RegisterInput = z.infer<typeof register>
export type LoginInput = z.infer<typeof login>
export type RecoverInput = z.infer<typeof recover>
