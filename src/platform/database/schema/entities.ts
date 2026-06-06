import {
	type AnyPgColumn,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['user', 'moderator', 'admin'])
export const visibilityEnum = pgEnum('visibility', ['open', 'anonymous'])
export const storyStatusEnum = pgEnum('story_status', [
	'processing',
	'ready',
	'published',
	'rejected',
	'hidden',
])

const timestamptz = (column: string) => timestamp(column, { withTimezone: true })

export const users = pgTable('users', {
	id: uuid('id').defaultRandom().primaryKey(),
	username: text('username').notNull().unique(),
	locale: text('locale').notNull().default('ru'),
	passwordHash: text('password_hash').notNull(),
	totpSecret: text('totp_secret'),
	recoveryHash: text('recovery_hash').notNull(),
	role: userRoleEnum('role').notNull().default('user'),
	bannedAt: timestamptz('banned_at'),
	// non-null marks a synthetic "bot" account and names its persona; real users are null
	botPersona: text('bot_persona'),
	createdAt: timestamptz('created_at').defaultNow().notNull(),
})

export const sessions = pgTable(
	'sessions',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		userAgent: text('user_agent'),
		ipHash: text('ip_hash'),
		ipSalt: text('ip_salt'),
		createdAt: timestamptz('created_at').defaultNow().notNull(),
		expiresAt: timestamptz('expires_at').notNull(),
	},
	t => [index('sessions_user_id_idx').on(t.userId)],
)

export const stories = pgTable(
	'stories',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		authorId: uuid('author_id')
			.notNull()
			.references(() => users.id),
		visibility: visibilityEnum('visibility').notNull().default('open'),
		status: storyStatusEnum('status').notNull().default('processing'),
		locale: text('locale').notNull(),
		raw: text('raw'), // nullable: cleared on publish
		headline: text('headline'), // short declarative for feed cards
		preview: text('preview'),
		title: text('title'),
		text: text('text'),
		replacements: jsonb('replacements').$type<Record<string, string>>(),
		category: text('category'),
		warnings: text('warnings').array().notNull().default([]),
		totalVoteCount: integer('total_vote_count').notNull().default(0),
		rejectionCode: text('rejection_code'),
		rejectionMessage: text('rejection_message'),
		createdAt: timestamptz('created_at').defaultNow().notNull(),
		updatedAt: timestamptz('updated_at').defaultNow().notNull(),
		publishedAt: timestamptz('published_at'),
	},
	t => [
		index('stories_feed_hot_idx').on(t.status, t.publishedAt, t.totalVoteCount),
		index('stories_feed_new_idx').on(t.status, t.publishedAt),
		index('stories_author_idx').on(t.authorId),
	],
)

export const voteOptions = pgTable(
	'vote_options',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		storyId: uuid('story_id')
			.notNull()
			.references(() => stories.id, { onDelete: 'cascade' }),
		label: text('label').notNull(),
		position: integer('position').notNull(),
		voteCount: integer('vote_count').notNull().default(0),
	},
	t => [unique('vote_options_story_position_uq').on(t.storyId, t.position)],
)

export const votes = pgTable(
	'votes',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		storyId: uuid('story_id')
			.notNull()
			.references(() => stories.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		optionId: uuid('option_id')
			.notNull()
			.references(() => voteOptions.id, { onDelete: 'cascade' }),
		createdAt: timestamptz('created_at').defaultNow().notNull(),
	},
	t => [unique('votes_story_user_uq').on(t.storyId, t.userId)],
)

export const comments = pgTable(
	'comments',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		storyId: uuid('story_id')
			.notNull()
			.references(() => stories.id, { onDelete: 'cascade' }),
		authorId: uuid('author_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		parentId: uuid('parent_id').references((): AnyPgColumn => comments.id, {
			onDelete: 'cascade',
		}),
		content: text('content').notNull(),
		status: text('status').notNull().default('published'), // 'published' | 'rejected'
		createdAt: timestamptz('created_at').defaultNow().notNull(),
	},
	t => [
		index('comments_story_idx').on(t.storyId, t.createdAt),
		index('comments_parent_idx').on(t.parentId),
	],
)

export const reports = pgTable(
	'reports',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		reporterId: uuid('reporter_id')
			.notNull()
			.references(() => users.id),
		storyId: uuid('story_id').references(() => stories.id, { onDelete: 'cascade' }),
		commentId: uuid('comment_id').references(() => comments.id, { onDelete: 'cascade' }),
		reason: text('reason').notNull(),
		resolvedAt: timestamptz('resolved_at'),
		resolvedBy: uuid('resolved_by').references(() => users.id),
		createdAt: timestamptz('created_at').defaultNow().notNull(),
	},
	t => [index('reports_unresolved_idx').on(t.resolvedAt, t.createdAt)],
)
