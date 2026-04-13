import { start, stop } from '@/bootstrap'

const app = await start()

const shutdown = async () => {
	await stop(app)
	process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
