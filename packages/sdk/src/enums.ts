/** biome-ignore-all lint/correctness/noUnusedVariables: sdk */
export function createEnum<const T extends Record<string, string>>(obj: T) {
	return {
		obj,
		values: Object.values(obj) as [
			(typeof obj)[keyof typeof obj],
			...(typeof obj)[keyof typeof obj][],
		],
	}
}

// user roles

const userRole = createEnum({
	User: 'user',
	Moderator: 'moderator',
	Admin: 'admin',
})
export const UserRole = userRole.obj
export type UserRole = (typeof UserRole)[keyof typeof UserRole]
export const USER_ROLES = userRole.values

// locales

const locale = createEnum({
	Ru: 'ru',
	En: 'en',
})
export const Locale = locale.obj
export type Locale = (typeof Locale)[keyof typeof Locale]
export const LOCALES = locale.values

// visibility

const visibility = createEnum({
	Open: 'open',
	Anonymous: 'anonymous',
})
export const Visibility = visibility.obj
export type Visibility = (typeof Visibility)[keyof typeof Visibility]
export const VISIBILITIES = visibility.values

// story status

const storyStatus = createEnum({
	Processing: 'processing',
	Ready: 'ready',
	Published: 'published',
	Rejected: 'rejected',
	Hidden: 'hidden',
})
export const StoryStatus = storyStatus.obj
export type StoryStatus = (typeof StoryStatus)[keyof typeof StoryStatus]
export const STORY_STATUSES = storyStatus.values

// categories

const category = createEnum({
	Work: 'work',
	CloseOnes: 'close_ones',
	Strangers: 'strangers',
	Self: 'self',
	Money: 'money',
	Other: 'other',
})
export const Category = category.obj
export type Category = (typeof Category)[keyof typeof Category]
export const CATEGORIES = category.values

// content warnings

const warning = createEnum({
	Violence: 'violence',
	SelfHarm: 'self_harm',
	Sexual: 'sexual',
	Substance: 'substance',
	Mental: 'mental',
	Death: 'death',
	Abuse: 'abuse',
	Hate: 'hate',
	Illegal: 'illegal',
	Minors: 'minors',
	Lgbt: 'lgbt',
})
export const Warning = warning.obj
export type Warning = (typeof Warning)[keyof typeof Warning]
export const WARNINGS = warning.values

// rejection codes

const rejection = createEnum({
	TooShort: 'too_short',
	NotAStory: 'not_a_story',
	Injection: 'injection',
	Harmful: 'harmful',
	ProcessingError: 'processing_error',
})
export const Rejection = rejection.obj
export type Rejection = (typeof Rejection)[keyof typeof Rejection]
export const REJECTIONS = rejection.values

// stream event types

const streamEvent = createEnum({
	Chunk: 'chunk',
	Ready: 'ready',
	Rejected: 'rejected',
	Failed: 'failed',
})
export const StreamEventType = streamEvent.obj
export type StreamEventType = (typeof StreamEventType)[keyof typeof StreamEventType]
export const STREAM_EVENT_TYPES = streamEvent.values
