import { useMutation, useQuery } from '@tanstack/react-query'
import type {
  VaultTopic,
  Question,
  QuestionnaireAnswers,
  QuestionnaireFollowupsResponse,
  QuestionnaireSubmitResponse,
} from '@halo/shared'

import { apiRequest } from './client'

interface QuestionnaireData {
  questions: Question[]
}

export function useQuestionnaireQuery(topic: VaultTopic) {
  return useQuery({
    queryKey: ['questionnaire', topic],
    queryFn: async (): Promise<QuestionnaireData> => {
      const result = await apiRequest<QuestionnaireData>(`/v1/scenarios/${topic}/questionnaire`)
      if (!result.success) throw new Error(result.error ?? 'Failed to load questionnaire')
      return result.data!
    },
  })
}

export function useQuestionnaireFollowupsMutation(topic: VaultTopic) {
  return useMutation({
    mutationFn: async (answers: QuestionnaireAnswers): Promise<QuestionnaireFollowupsResponse> => {
      const result = await apiRequest<QuestionnaireFollowupsResponse>(
        `/v1/scenarios/${topic}/questionnaire/followups`,
        { method: 'POST', body: JSON.stringify({ answers }) },
      )
      if (!result.success) throw new Error(result.error ?? 'Failed to generate follow-up questions')
      return result.data!
    },
  })
}

export function useSubmitQuestionnaireMutation(topic: VaultTopic) {
  return useMutation({
    mutationFn: async (answers: QuestionnaireAnswers): Promise<QuestionnaireSubmitResponse> => {
      const result = await apiRequest<QuestionnaireSubmitResponse>(
        `/v1/scenarios/${topic}/questionnaire/submit`,
        { method: 'POST', body: JSON.stringify({ answers }) },
      )
      if (!result.success) throw new Error(result.error ?? 'Failed to generate proposals')
      return result.data!
    },
  })
}
