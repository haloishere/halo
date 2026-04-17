import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { fireEvent } from '@testing-library/react-native'
import { render } from '../../../test/render'
import { DailyTipCard, DAILY_TIPS } from '../DailyTipCard'

vi.mock('@tamagui/lucide-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory must use require
  const { Text } = require('react-native')
  return {
    Lightbulb: (props: Record<string, unknown>) => <Text testID="icon-lightbulb" {...props} />,
    RefreshCw: (props: Record<string, unknown>) => <Text testID="icon-refresh" {...props} />,
  }
})

describe('DailyTipCard — rendering', () => {
  it('renders the title "Daily Tip"', () => {
    const { getByText } = render(<DailyTipCard tip="Stay hydrated throughout the day." />)
    expect(getByText('Daily Tip')).toBeTruthy()
  })

  it('renders the tip text', () => {
    const { getByText } = render(<DailyTipCard tip="Stay hydrated throughout the day." />)
    expect(getByText('Stay hydrated throughout the day.')).toBeTruthy()
  })

  it('renders category when provided', () => {
    const { getByText } = render(<DailyTipCard tip="Take a break." category="Self Care" />)
    expect(getByText('Self Care')).toBeTruthy()
  })

  it('does not render category when omitted', () => {
    const { queryByTestId } = render(<DailyTipCard tip="Take a break." />)
    expect(queryByTestId('daily-tip-category')).toBeNull()
  })
})

describe('DailyTipCard — accessibility', () => {
  it('is accessible as a text element', () => {
    const { getByRole } = render(<DailyTipCard tip="Stay hydrated." />)
    expect(getByRole('text')).toBeTruthy()
  })
})

describe('DailyTipCard — refresh button', () => {
  it('renders refresh button when onRefresh is provided', () => {
    const { getByTestId } = render(<DailyTipCard tip="Stay hydrated." onRefresh={() => {}} />)
    expect(getByTestId('daily-tip-refresh')).toBeTruthy()
  })

  it('does NOT render refresh button when onRefresh is omitted', () => {
    const { queryByTestId } = render(<DailyTipCard tip="Stay hydrated." />)
    expect(queryByTestId('daily-tip-refresh')).toBeNull()
  })

  it('calls onRefresh when refresh button is pressed', () => {
    const handleRefresh = vi.fn()
    const { getByTestId } = render(<DailyTipCard tip="Stay hydrated." onRefresh={handleRefresh} />)
    fireEvent.press(getByTestId('daily-tip-refresh'))
    expect(handleRefresh).toHaveBeenCalledTimes(1)
  })

  it('refresh button has accessibility label "Get new tip"', () => {
    const { getByLabelText } = render(<DailyTipCard tip="Stay hydrated." onRefresh={() => {}} />)
    expect(getByLabelText('Get new tip')).toBeTruthy()
  })

  it('refresh button is disabled when isRefreshing is true', () => {
    const { getByTestId } = render(
      <DailyTipCard tip="Stay hydrated." onRefresh={() => {}} isRefreshing />,
    )
    const button = getByTestId('daily-tip-refresh')
    expect(button.props.accessibilityState?.disabled).toBe(true)
  })
})

describe('DAILY_TIPS — tip rotation', () => {
  it('exports 7 tips (one per day of week)', () => {
    expect(DAILY_TIPS).toHaveLength(7)
  })

  it('each tip has a tip and category', () => {
    for (const entry of DAILY_TIPS) {
      expect(entry.tip).toBeTruthy()
      expect(entry.category).toBeTruthy()
    }
  })
})
