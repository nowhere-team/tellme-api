import { relations } from 'drizzle-orm'

import { comments, reports, sessions, stories, users, voteOptions, votes } from './entities'

export const usersRelations = relations(users, ({ many }) => ({
	sessions: many(sessions),
	stories: many(stories),
	votes: many(votes),
	comments: many(comments),
	reports: many(reports, { relationName: 'reporter' }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const storiesRelations = relations(stories, ({ one, many }) => ({
	author: one(users, { fields: [stories.authorId], references: [users.id] }),
	options: many(voteOptions),
	votes: many(votes),
	comments: many(comments),
	reports: many(reports),
}))

export const voteOptionsRelations = relations(voteOptions, ({ one, many }) => ({
	story: one(stories, { fields: [voteOptions.storyId], references: [stories.id] }),
	votes: many(votes),
}))

export const votesRelations = relations(votes, ({ one }) => ({
	story: one(stories, { fields: [votes.storyId], references: [stories.id] }),
	user: one(users, { fields: [votes.userId], references: [users.id] }),
	option: one(voteOptions, { fields: [votes.optionId], references: [voteOptions.id] }),
}))

export const commentsRelations = relations(comments, ({ one, many }) => ({
	story: one(stories, { fields: [comments.storyId], references: [stories.id] }),
	author: one(users, { fields: [comments.authorId], references: [users.id] }),
	parent: one(comments, {
		fields: [comments.parentId],
		references: [comments.id],
		relationName: 'replies',
	}),
	replies: many(comments, { relationName: 'replies' }),
}))

export const reportsRelations = relations(reports, ({ one }) => ({
	reporter: one(users, {
		fields: [reports.reporterId],
		references: [users.id],
		relationName: 'reporter',
	}),
	resolver: one(users, { fields: [reports.resolvedBy], references: [users.id] }),
	story: one(stories, { fields: [reports.storyId], references: [stories.id] }),
	comment: one(comments, { fields: [reports.commentId], references: [comments.id] }),
}))
