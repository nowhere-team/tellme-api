export type ErrorCode =
	| 'NOT_FOUND'
	| 'CONFLICT'
	| 'FORBIDDEN'
	| 'VALIDATION_ERROR'
	| 'INTERNAL_ERROR'

const STATUS_MAP: Record<ErrorCode, number> = {
	NOT_FOUND: 404,
	CONFLICT: 409,
	FORBIDDEN: 403,
	VALIDATION_ERROR: 400,
	INTERNAL_ERROR: 500,
}

export class AppError extends Error {
	override readonly name = 'AppError'
	readonly status: number

	constructor(
		readonly code: ErrorCode,
		message: string,
	) {
		super(message)
		this.status = STATUS_MAP[code]
	}

	static notFound = (entity: string, id?: string) =>
		new AppError('NOT_FOUND', id ? `${entity} with id ${id} not found` : `${entity} not found`)

	static conflict = (message: string) => new AppError('CONFLICT', message)

	static forbidden = (message: string) => new AppError('FORBIDDEN', message)

	static validation = (message: string) => new AppError('VALIDATION_ERROR', message)
}
