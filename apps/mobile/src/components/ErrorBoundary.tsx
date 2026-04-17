import React from 'react'
import { YStack, Heading, SizableText } from 'tamagui'
import { Button } from './ui/Button'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  private handleReset = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return (
        <YStack
          flex={1}
          justifyContent="center"
          alignItems="center"
          padding="$8"
          backgroundColor="$background"
        >
          <Heading size="$8" color="$color" marginBottom="$3">
            Something went wrong
          </Heading>
          <SizableText size="$5" color="$color8" textAlign="center" marginBottom="$5">
            The app encountered an unexpected error. Tap below to try again.
          </SizableText>
          <Button label="Tap to retry" onPress={this.handleReset} />
        </YStack>
      )
    }

    return this.props.children
  }
}
