import type { OpenRouterClient } from '@/platform/openrouter'

const SYSTEM = `you are a comment moderator for a community storytelling platform. 
users share personal moral dilemmas. your job: decide approve or reject for a single comment.

reject ONLY if the comment contains:
- explicit hate speech or slurs targeting a group
- direct personal threats
- spam or advertising
- content that doxes or identifies real people

do NOT reject for: rudeness, strong opinions, profanity, criticism of the story author's choices.

respond with exactly one word: approve or reject`

export type ModerationVerdict = 'approve' | 'reject'

export interface CommentModerator {
	check(content: string): Promise<ModerationVerdict>
}

export class AiCommentModerator implements CommentModerator {
	constructor(private readonly openrouter: OpenRouterClient) {}

	async check(content: string): Promise<ModerationVerdict> {
		try {
			const { final } = this.openrouter.generateStream<string>({
				system: SYSTEM,
				user: content.slice(0, 500),
				temperature: 0,
				paths: ['$'],
			})
			const result = (await final).trim().toLowerCase()
			return result === 'reject' ? 'reject' : 'approve'
		} catch {
			return 'approve' // fail open: better to let borderline through than break posting
		}
	}
}

export class PassthroughCommentModerator implements CommentModerator {
	async check(): Promise<ModerationVerdict> {
		return 'approve'
	}
}
