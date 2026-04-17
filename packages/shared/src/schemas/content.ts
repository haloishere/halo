import { z } from 'zod'
import { CONTENT_CATEGORIES, DIAGNOSIS_STAGES, TIP_CATEGORIES } from '../constants/enums.js'

export const contentSearchSchema = z.object({
  search: z.string().max(200).optional(),
  category: z.enum(CONTENT_CATEGORIES).optional(),
  stage: z.enum(DIAGNOSIS_STAGES).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const createContentSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/),
  body: z.string().min(1).max(50_000),
  category: z.enum(CONTENT_CATEGORIES),
  diagnosisStages: z.array(z.enum(DIAGNOSIS_STAGES)).min(1),
  videoUrl: z.string().url().optional(),
})

export const updateContentSchema = createContentSchema.partial()

export const bookmarkSchema = z.object({
  contentItemId: z.string().uuid(),
})

export const bookmarkListSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const progressSchema = z.object({
  contentItemId: z.string().uuid(),
  progressPercent: z.number().int().min(0).max(100),
})

export const contentSlugParamsSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/),
})

export const contentIdParamsSchema = z.object({
  id: z.string().uuid(),
})

export const progressUpdateSchema = z.object({
  progressPercent: z.number().int().min(0).max(100),
})

export const contentItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  body: z.string(),
  category: z.enum(CONTENT_CATEGORIES),
  diagnosisStages: z.array(z.enum(DIAGNOSIS_STAGES)),
  videoUrl: z.string().url().nullable(),
  thumbnailUrl: z.string().url().nullable(),
  authorId: z.string().uuid().nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const contentListItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  snippet: z.string(),
  category: z.enum(CONTENT_CATEGORIES),
  diagnosisStages: z.array(z.enum(DIAGNOSIS_STAGES)),
  videoUrl: z.string().url().nullable(),
  thumbnailUrl: z.string().url().nullable(),
  isBookmarked: z.boolean(),
  progressPercent: z.number().int().min(0).max(100).nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
})

export const dailyTipSchema = z.object({
  tip: z.string().min(1).max(300),
  category: z.enum(TIP_CATEGORIES),
})

export type DailyTip = z.infer<typeof dailyTipSchema>
export type ContentSearch = z.infer<typeof contentSearchSchema>
export type CreateContent = z.infer<typeof createContentSchema>
export type UpdateContent = z.infer<typeof updateContentSchema>
export type Bookmark = z.infer<typeof bookmarkSchema>
export type Progress = z.infer<typeof progressSchema>
export type ContentItem = z.infer<typeof contentItemSchema>
export type ContentListItem = z.infer<typeof contentListItemSchema>
export type ProgressUpdate = z.infer<typeof progressUpdateSchema>
