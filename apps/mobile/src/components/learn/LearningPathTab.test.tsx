import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { Text } from 'react-native'
import { render } from '../../test/render'
import { LearningPathTab } from './LearningPathTab'

vi.mock('@tamagui/lucide-icons', () => ({
  GraduationCap: (props: Record<string, unknown>) => <Text {...props}>GraduationCapIcon</Text>,
  Target: (props: Record<string, unknown>) => <Text {...props}>TargetIcon</Text>,
  TrendingUp: (props: Record<string, unknown>) => <Text {...props}>TrendingUpIcon</Text>,
  Award: (props: Record<string, unknown>) => <Text {...props}>AwardIcon</Text>,
}))

describe('LearningPathTab', () => {
  it('renders Coming Soon heading', () => {
    const { getByText } = render(<LearningPathTab />)
    expect(getByText('Learning Path')).toBeTruthy()
    expect(getByText('Coming Soon')).toBeTruthy()
  })

  it('renders description text', () => {
    const { getByText } = render(<LearningPathTab />)
    expect(
      getByText(/Personalized learning journeys/),
    ).toBeTruthy()
  })

  it('renders milestone previews', () => {
    const { getByText } = render(<LearningPathTab />)
    expect(getByText('Personalized Paths')).toBeTruthy()
    expect(getByText('Progress Tracking')).toBeTruthy()
    expect(getByText('Milestones & Goals')).toBeTruthy()
  })

  it('renders progress preview', () => {
    const { getByText } = render(<LearningPathTab />)
    expect(getByText('Your Progress')).toBeTruthy()
    expect(getByText('Start your journey soon')).toBeTruthy()
  })
})
