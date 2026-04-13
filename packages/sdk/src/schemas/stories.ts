// @examples
// import { z } from 'zod'
//
// import { STORY_STATUSES, STORY_VISIBILITIES } from '../enums'
// import { uuid } from './common'
//
// export const createStory = z.object({
//     title: z.string().min(1).max(255),
//     description: z.string().max(2000).optional(),
//     visibility: z.enum(STORY_VISIBILITIES).optional(),
// })
//
// export const updateStory = z.object({
//     title: z.string().min(1).max(255).optional(),
//     description: z.string().max(2000).nullish(),
//     status: z.enum(STORY_STATUSES).optional(),
//     visibility: z.enum(STORY_VISIBILITIES).optional(),
// })
//
// export const storiesQuery = z.object({
//     status: z.enum(STORY_STATUSES).optional(),
//     visibility: z.enum(STORY_VISIBILITIES).optional(),
//     limit: z.coerce.number().int().min(1).max(50).optional(),
//     cursor: z.string().optional(),
// })
//
// export type CreateStory = z.infer<typeof createStory>
// export type UpdateStory = z.infer<typeof updateStory>
// export type StoriesQuery = z.infer<typeof storiesQuery>
