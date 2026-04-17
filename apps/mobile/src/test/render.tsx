import React from 'react'
import { render, type RenderOptions } from '@testing-library/react-native'
import { TamaguiProvider } from 'tamagui'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import tamaguiConfig from '../../tamagui.config'

const TEST_INSETS = { top: 0, right: 0, bottom: 0, left: 0 }

// Tests use a fixed "light" theme for deterministic assertions (snapshots, color checks).
// Use darkRender() when explicitly testing dark mode behavior.
function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider
      initialMetrics={{ insets: TEST_INSETS, frame: { x: 0, y: 0, width: 390, height: 844 } }}
    >
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {children}
      </TamaguiProvider>
    </SafeAreaProvider>
  )
}

function DarkProviders({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider
      initialMetrics={{ insets: TEST_INSETS, frame: { x: 0, y: 0, width: 390, height: 844 } }}
    >
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        {children}
      </TamaguiProvider>
    </SafeAreaProvider>
  )
}

const customRender = (ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: AllProviders, ...options })

const darkRender = (ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: DarkProviders, ...options })

// Re-export everything from @testing-library/react-native
export * from '@testing-library/react-native'
// Override render with our custom version
export { customRender as render, darkRender }
