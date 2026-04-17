import '@tamagui/native/setup-teleport'
import '@tamagui/native/setup-burnt'
import { useEffect, useRef } from 'react'
import { useColorScheme } from 'react-native'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { useFonts, GrandHotel_400Regular } from '@expo-google-fonts/grand-hotel'
import * as SplashScreen from 'expo-splash-screen'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { TamaguiProvider, Theme } from 'tamagui'
import { ToastProvider } from '@tamagui/toast'
import { CurrentToast } from '../src/components/ui/CurrentToast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import tamaguiConfig from '../tamagui.config'
import Constants from 'expo-constants'
import { ErrorBoundary } from '../src/components/ErrorBoundary'
import { configureGoogleSignIn } from '../src/lib/google-auth'
import { resolveTheme } from '../src/lib/resolve-theme'
import { useAuth } from '../src/hooks/useAuth'
import { useAuthStore } from '../src/stores/auth'
import { useThemeStore } from '../src/stores/theme'

const queryClient = new QueryClient()

function AuthGuard() {
  const router = useRouter()
  const segments = useSegments()
  const { user, dbUser, isLoading } = useAuthStore()

  useEffect(() => {
    if (isLoading) return

    const inAuth = segments[0] === '(auth)'
    const inOnboarding = segments[0] === '(onboarding)'
    const isAuthenticated = !!user
    const hasDbUser = !!dbUser
    const hasCompletedOnboarding = dbUser?.onboardingCompleted != null

    if (!isAuthenticated && !inAuth) {
      router.replace('/(auth)/enter-email')
    } else if (isAuthenticated && !hasDbUser) {
      // Firebase user exists but DB sync hasn't completed yet.
      // Stay on auth screen — useAuth will retry sync on next onAuthStateChanged event.
      if (!inAuth) router.replace('/(auth)/enter-email')
    } else if (isAuthenticated && hasDbUser && !hasCompletedOnboarding && !inOnboarding) {
      router.replace('/(onboarding)/welcome')
    } else if (isAuthenticated && hasCompletedOnboarding && (inAuth || inOnboarding)) {
      router.replace('/(tabs)/')
    }
  }, [user, dbUser, isLoading, segments, router])

  return null
}

function RootLayoutInner() {
  useAuth()

  return (
    <>
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </>
  )
}

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const { mode } = useThemeStore()
  const theme = resolveTheme(mode, colorScheme)
  const statusBarStyle = theme === 'dark' ? 'light' : 'dark'

  const [fontsLoaded] = useFonts({ GrandHotel_400Regular })

  const googleConfigured = useRef(false)
  if (!googleConfigured.current) {
    const webClientId = Constants.expoConfig?.extra?.googleWebClientId as string | undefined
    if (webClientId) {
      configureGoogleSignIn(webClientId)
    }
    googleConfigured.current = true
  }

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync()
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <QueryClientProvider client={queryClient}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <Theme name={theme}>
          <StatusBar style={statusBarStyle} />
          <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
            <ToastProvider duration={4000}>
              <ErrorBoundary>
                <RootLayoutInner />
              </ErrorBoundary>
              <CurrentToast />
            </ToastProvider>
          </KeyboardProvider>
        </Theme>
      </TamaguiProvider>
    </QueryClientProvider>
  )
}
