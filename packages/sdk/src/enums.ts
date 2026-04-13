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

// story visibility

const visibility = createEnum({
	Open: 'open',
	Anonymous: 'anonymous',
})
export const Visibility = visibility.obj
export type Visibility = (typeof Visibility)[keyof typeof Visibility]
export const VISIBILITIES = visibility.values

// story status

const storyStatus = createEnum({
	Draft: 'draft',
	Published: 'published',
	Hidden: 'hidden',
})
export const StoryStatus = storyStatus.obj
export type StoryStatus = (typeof StoryStatus)[keyof typeof StoryStatus]
export const STORY_STATUSES = storyStatus.values
