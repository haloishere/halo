import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from '@testing-library/react-native'
import { renderHookWithProviders } from '../../test/renderWithProviders'

vi.mock('../client', () => ({
  apiRequest: vi.fn(),
}))

import { apiRequest } from '../client'
import { useQuestionnaireFollowupsMutation, useSubmitQuestionnaireMutation } from '../scenarios'

const mockApiRequest = vi.mocked(apiRequest)

const ANSWERS = {
  food_diet: { chips: ['Vegetarian'], freeText: 'mostly dairy-free too' },
  food_cuisine: { chips: ['Japanese'] },
}

const FOLLOWUP_QUESTION = {
  id: 'follow_1',
  prompt: 'Do you prefer ramen or sushi?',
  chips: ['Ramen', 'Sushi', 'Both'],
  allowFreeText: false,
}

const PROPOSAL = {
  topic: 'food_and_restaurants',
  label: 'vegetarian',
  value: 'Follows a vegetarian diet',
}

beforeEach(() => {
  mockApiRequest.mockReset()
})

describe('useQuestionnaireFollowupsMutation', () => {
  it('POSTs to /v1/scenarios/:topic/questionnaire/followups', async () => {
    mockApiRequest.mockResolvedValueOnce({
      success: true,
      data: { followups: [FOLLOWUP_QUESTION] },
    })

    const { result } = renderHookWithProviders(() =>
      useQuestionnaireFollowupsMutation('food_and_restaurants'),
    )

    let data: unknown
    await act(async () => {
      data = await result.current.mutateAsync(ANSWERS)
    })

    expect(mockApiRequest).toHaveBeenCalledWith(
      '/v1/scenarios/food_and_restaurants/questionnaire/followups',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ answers: ANSWERS }),
      }),
    )
    expect(data).toEqual({ followups: [FOLLOWUP_QUESTION] })
  })

  it('throws when the API returns success: false', async () => {
    mockApiRequest.mockResolvedValueOnce({ success: false, error: 'Service unavailable' })

    const { result } = renderHookWithProviders(() =>
      useQuestionnaireFollowupsMutation('food_and_restaurants'),
    )

    await act(async () => {
      await expect(result.current.mutateAsync(ANSWERS)).rejects.toThrow('Service unavailable')
    })
  })
})

describe('useSubmitQuestionnaireMutation', () => {
  it('POSTs to /v1/scenarios/:topic/questionnaire/submit', async () => {
    mockApiRequest.mockResolvedValueOnce({
      success: true,
      data: { proposals: [PROPOSAL] },
    })

    const { result } = renderHookWithProviders(() =>
      useSubmitQuestionnaireMutation('food_and_restaurants'),
    )

    let data: unknown
    await act(async () => {
      data = await result.current.mutateAsync(ANSWERS)
    })

    expect(mockApiRequest).toHaveBeenCalledWith(
      '/v1/scenarios/food_and_restaurants/questionnaire/submit',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ answers: ANSWERS }),
      }),
    )
    expect(data).toEqual({ proposals: [PROPOSAL] })
  })

  it('falls back to a readable error when the envelope has no error field', async () => {
    mockApiRequest.mockResolvedValueOnce({ success: false } as never)

    const { result } = renderHookWithProviders(() =>
      useSubmitQuestionnaireMutation('food_and_restaurants'),
    )

    await act(async () => {
      await expect(result.current.mutateAsync(ANSWERS)).rejects.toThrow(
        'Failed to generate proposals',
      )
    })
  })
})
