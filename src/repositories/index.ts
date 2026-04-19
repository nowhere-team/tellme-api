import type { Database } from '@/platform/database'

import { SessionRepository } from './sessions'
import { StoryRepository } from './stories'
import { UserRepository } from './users'
import { VoteRepository } from './votes'

export type Repositories = ReturnType<typeof createRepositories>

export function createRepositories(db: Database) {
	return {
		users: new UserRepository(db),
		sessions: new SessionRepository(db),
		stories: new StoryRepository(db),
		votes: new VoteRepository(db),
	}
}

export type { DbSession } from './sessions'
export { SessionRepository } from './sessions'
export type { DbStory, DbVoteOption, StoryWithOptions } from './stories'
export { StoryRepository } from './stories'
export type { DbUser } from './users'
export { UserRepository } from './users'
export type { DbVote } from './votes'
export { VoteRepository } from './votes'
