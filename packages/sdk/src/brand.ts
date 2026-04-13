declare const brand: unique symbol

export type Brand<T, B> = T & { readonly [brand]: B }

export type UserId = Brand<string, 'UserId'>
export type StoryId = Brand<string, 'StoryId'>
export type CategoryId = Brand<string, 'CategoryId'>
export type CommentId = Brand<string, 'CommentId'>
export type VoteOptionId = Brand<string, 'VoteOptionId'>
export type SessionId = Brand<string, 'SessionId'>
export type ReportId = Brand<string, 'ReportId'>

export const UserId = (id: string) => id as UserId
export const StoryId = (id: string) => id as StoryId
export const CategoryId = (id: string) => id as CategoryId
export const CommentId = (id: string) => id as CommentId
export const VoteOptionId = (id: string) => id as VoteOptionId
export const SessionId = (id: string) => id as SessionId
export const ReportId = (id: string) => id as ReportId
