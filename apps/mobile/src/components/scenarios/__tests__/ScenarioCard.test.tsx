import { describe, it, expect, vi } from 'vitest'
import { Text } from 'react-native'
import { render, fireEvent } from '../../../test/render'
import { ScenarioCard } from '../ScenarioCard'

describe('ScenarioCard', () => {
  it('renders the title, description, and icon', () => {
    const { getByText, getByTestId } = render(
      <ScenarioCard
        topic="fashion"
        title="Fashion"
        description="Outfits and style"
        icon={<Text testID="icon-stub">🧥</Text>}
        onPress={vi.fn()}
      />,
    )
    expect(getByText('Fashion')).toBeTruthy()
    expect(getByText('Outfits and style')).toBeTruthy()
    expect(getByTestId('icon-stub')).toBeTruthy()
  })

  it('fires onPress with the bound topic when tapped', () => {
    const onPress = vi.fn()
    const { getByLabelText } = render(
      <ScenarioCard
        topic="lifestyle_and_travel"
        title="Lifestyle & Travel"
        description="Places and routines"
        icon={<Text>🌴</Text>}
        onPress={onPress}
      />,
    )

    fireEvent.press(getByLabelText('Lifestyle & Travel scenario'))

    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onPress).toHaveBeenCalledWith('lifestyle_and_travel')
  })

  it('exposes accessibilityRole="button"', () => {
    const { getByLabelText } = render(
      <ScenarioCard
        topic="food_and_restaurants"
        title="Food & Restaurants"
        description="x"
        icon={<Text>🍜</Text>}
        onPress={vi.fn()}
      />,
    )
    expect(getByLabelText('Food & Restaurants scenario').props.accessibilityRole).toBe('button')
  })
})
