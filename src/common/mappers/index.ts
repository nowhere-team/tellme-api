// @example
// src/common/mappers/story.ts
// import { type Story, StoryId, UserId, type Chapter, ChapterId } from '@nowhere-team/tellme-sdk'
// import type { DbStory, DbChapter } from '@/platform/database'
//
// export const toChapter = (db: DbChapter): Chapter => ({
//     id: ChapterId(db.id),
//     storyId: StoryId(db.storyId),
//     title: db.title,
//     content: db.content,
//     displayOrder: db.displayOrder,
//     createdAt: db.createdAt,
// })
//
// export const toStory = (db: DbStory, chapters: DbChapter[]): Story => ({
//     id: StoryId(db.id),
//     authorId: UserId(db.authorId),
//     title: db.title,
//     description: db.description,
//     status: db.status,
//     visibility: db.visibility,
//     chapters: chapters.map(toChapter),
//     createdAt: db.createdAt,
//     updatedAt: db.updatedAt,
// })
