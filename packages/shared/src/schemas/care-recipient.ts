import { z } from 'zod'
import { CAREGIVER_RELATIONSHIPS, DIAGNOSIS_STAGES } from '../constants/enums.js'

const DOB_MIN = '1900-01-01'

export const createCareRecipientSchema = z.object({
  name: z.string().trim().min(1).max(100),
  relationship: z.enum(CAREGIVER_RELATIONSHIPS),
  diagnosisStage: z.enum(DIAGNOSIS_STAGES),
  diagnosisDetails: z.string().max(1000).optional(),
  dateOfBirth: z
    .string()
    .date()
    .refine(
      (d) => {
        if (d < DOB_MIN) return false
        // Compute the cutoff at parse time so a long-running server never has a stale value.
        // Use setFullYear to avoid month/day edge cases around the year boundary.
        const today = new Date()
        const cutoff = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
        return d <= cutoff.toISOString().slice(0, 10)
      },
      { message: 'dateOfBirth must be between 1900-01-01 and 18 years ago' },
    )
    .optional(),
})

export const updateCareRecipientSchema = createCareRecipientSchema.partial()

export type CreateCareRecipient = z.infer<typeof createCareRecipientSchema>
export type UpdateCareRecipient = z.infer<typeof updateCareRecipientSchema>
