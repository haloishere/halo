import { z } from 'zod'
import { memoryProposalSchema } from './ai-chat.js'

// ── Question (one step in the questionnaire) ─────────────────────────────────

export const questionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  chips: z.array(z.string()),
  allowFreeText: z.boolean(),
})

export type Question = z.infer<typeof questionSchema>

// ── Answer (the user's response to a single question) ────────────────────────

export const questionAnswerSchema = z.object({
  chips: z.array(z.string().max(100)).max(20),
  freeText: z.string().max(300).optional(),
})

export type QuestionAnswer = z.infer<typeof questionAnswerSchema>

// Map of question id → answer. Sent to both /followups and /submit.
// .refine caps the key count — z.record() has no built-in .max().
export const questionnaireAnswersSchema = z
  .record(z.string(), questionAnswerSchema)
  .refine((obj) => Object.keys(obj).length <= 10, { message: 'Too many answers (max 10)' })

export type QuestionnaireAnswers = z.infer<typeof questionnaireAnswersSchema>

// ── API request / response envelopes ─────────────────────────────────────────

// Shared by both /followups and /submit — both accept the same answers payload.
export const questionnaireAnswersRequestSchema = z.object({
  answers: questionnaireAnswersSchema,
})

export const questionnaireFollowupsResponseSchema = z.object({
  followups: z.array(questionSchema),
})

export const questionnaireSubmitResponseSchema = z.object({
  proposals: z.array(memoryProposalSchema),
})

export type QuestionnaireAnswersRequest = z.infer<typeof questionnaireAnswersRequestSchema>
export type QuestionnaireFollowupsResponse = z.infer<typeof questionnaireFollowupsResponseSchema>
export type QuestionnaireSubmitResponse = z.infer<typeof questionnaireSubmitResponseSchema>
