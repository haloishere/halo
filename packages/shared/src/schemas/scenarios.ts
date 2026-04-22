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
  chips: z.array(z.string()),
  freeText: z.string().optional(),
})

export type QuestionAnswer = z.infer<typeof questionAnswerSchema>

// Map of question id → answer. Sent to both /followups and /submit.
export const questionnaireAnswersSchema = z.record(z.string(), questionAnswerSchema)

export type QuestionnaireAnswers = z.infer<typeof questionnaireAnswersSchema>

// ── API request / response envelopes ─────────────────────────────────────────

export const questionnaireFollowupsRequestSchema = z.object({
  answers: questionnaireAnswersSchema,
})

export const questionnaireFollowupsResponseSchema = z.object({
  followups: z.array(questionSchema),
})

export const questionnaireSubmitRequestSchema = z.object({
  answers: questionnaireAnswersSchema,
})

export const questionnaireSubmitResponseSchema = z.object({
  proposals: z.array(memoryProposalSchema),
})

export type QuestionnaireFollowupsRequest = z.infer<typeof questionnaireFollowupsRequestSchema>
export type QuestionnaireFollowupsResponse = z.infer<typeof questionnaireFollowupsResponseSchema>
export type QuestionnaireSubmitRequest = z.infer<typeof questionnaireSubmitRequestSchema>
export type QuestionnaireSubmitResponse = z.infer<typeof questionnaireSubmitResponseSchema>
