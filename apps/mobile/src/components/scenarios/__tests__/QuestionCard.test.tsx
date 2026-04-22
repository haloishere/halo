import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '../../../test/render'
import { QuestionCard } from '../QuestionCard'
import type { Question, QuestionAnswer } from '@halo/shared'

const FOOD_DIET_QUESTION: Question = {
  id: 'food_diet',
  prompt: 'Do you follow any diet or have food restrictions?',
  chips: ['Vegetarian', 'Vegan', 'Gluten-free', 'None'],
  allowFreeText: true,
}

const FOOD_VIBE_QUESTION: Question = {
  id: 'food_vibe',
  prompt: 'What kind of dining experience do you prefer?',
  chips: ['Casual', 'Fine dining', 'Street food'],
  allowFreeText: false,
}

const EMPTY_ANSWER: QuestionAnswer = { chips: [] }

describe('QuestionCard — rendering', () => {
  it('renders the question prompt', () => {
    const { getByText } = render(
      <QuestionCard question={FOOD_DIET_QUESTION} answer={EMPTY_ANSWER} onChange={vi.fn()} />,
    )
    expect(getByText(FOOD_DIET_QUESTION.prompt)).toBeTruthy()
  })

  it('renders all chip options', () => {
    const { getByText } = render(
      <QuestionCard question={FOOD_DIET_QUESTION} answer={EMPTY_ANSWER} onChange={vi.fn()} />,
    )
    for (const chip of FOOD_DIET_QUESTION.chips) {
      expect(getByText(chip)).toBeTruthy()
    }
  })

  it('renders free-text input when allowFreeText is true', () => {
    const { getByLabelText } = render(
      <QuestionCard question={FOOD_DIET_QUESTION} answer={EMPTY_ANSWER} onChange={vi.fn()} />,
    )
    expect(getByLabelText('Additional details')).toBeTruthy()
  })

  it('does NOT render free-text input when allowFreeText is false', () => {
    const { queryByLabelText } = render(
      <QuestionCard question={FOOD_VIBE_QUESTION} answer={EMPTY_ANSWER} onChange={vi.fn()} />,
    )
    expect(queryByLabelText('Additional details')).toBeNull()
  })
})

describe('QuestionCard — chip interactions', () => {
  it('calls onChange with the toggled chip added when tapping an unselected chip', () => {
    const onChange = vi.fn()
    const { getByText } = render(
      <QuestionCard question={FOOD_DIET_QUESTION} answer={EMPTY_ANSWER} onChange={onChange} />,
    )
    fireEvent.press(getByText('Vegetarian'))
    expect(onChange).toHaveBeenCalledWith({ chips: ['Vegetarian'] })
  })

  it('calls onChange with the chip removed when tapping a selected chip (toggle off)', () => {
    const onChange = vi.fn()
    const selected: QuestionAnswer = { chips: ['Vegetarian', 'Vegan'] }
    const { getByText } = render(
      <QuestionCard question={FOOD_DIET_QUESTION} answer={selected} onChange={onChange} />,
    )
    fireEvent.press(getByText('Vegetarian'))
    expect(onChange).toHaveBeenCalledWith({ chips: ['Vegan'] })
  })

  it('supports multi-select — tapping two different chips accumulates both', () => {
    const onChange = vi.fn()
    const { getByText } = render(
      <QuestionCard question={FOOD_DIET_QUESTION} answer={EMPTY_ANSWER} onChange={onChange} />,
    )
    fireEvent.press(getByText('Vegetarian'))
    const afterFirst = onChange.mock.calls[0][0] as QuestionAnswer
    // Simulate parent updating answer and re-rendering
    onChange.mockClear()
    const { getByText: getByText2 } = render(
      <QuestionCard question={FOOD_DIET_QUESTION} answer={afterFirst} onChange={onChange} />,
    )
    fireEvent.press(getByText2('Vegan'))
    expect(onChange).toHaveBeenCalledWith({ chips: ['Vegetarian', 'Vegan'] })
  })
})

describe('QuestionCard — free-text input', () => {
  it('calls onChange with updated freeText when the user types', () => {
    const onChange = vi.fn()
    const { getByLabelText } = render(
      <QuestionCard question={FOOD_DIET_QUESTION} answer={EMPTY_ANSWER} onChange={onChange} />,
    )
    fireEvent.changeText(getByLabelText('Additional details'), 'also lactose intolerant')
    expect(onChange).toHaveBeenCalledWith({ chips: [], freeText: 'also lactose intolerant' })
  })

  it('preserves existing chip selections when updating freeText', () => {
    const onChange = vi.fn()
    const existing: QuestionAnswer = { chips: ['Vegetarian'] }
    const { getByLabelText } = render(
      <QuestionCard question={FOOD_DIET_QUESTION} answer={existing} onChange={onChange} />,
    )
    fireEvent.changeText(getByLabelText('Additional details'), 'note')
    expect(onChange).toHaveBeenCalledWith({ chips: ['Vegetarian'], freeText: 'note' })
  })
})
