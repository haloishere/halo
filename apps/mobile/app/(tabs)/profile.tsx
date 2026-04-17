import { Alert } from 'react-native'
import { YStack, Heading, SizableText } from 'tamagui'
import { signOut } from 'firebase/auth'
import * as SecureStore from 'expo-secure-store'
import { auth } from '../../src/lib/firebase'
import { getAuthErrorMessage } from '../../src/lib/auth-errors'
import { useAuthStore } from '../../src/stores/auth'
import { AnimatedScreen, Button, ThemeToggle } from '../../src/components/ui'

export default function ProfileScreen() {
  const { dbUser } = useAuthStore()

  async function handleSignOut() {
    try {
      // Mark as intentional sign-out so useAuth doesn't show "session ended" toast
      useAuthStore.getState().clearUser()
      await SecureStore.deleteItemAsync('halo_last_token').catch(() => {})
      await signOut(auth)
    } catch (err) {
      Alert.alert('Sign out failed', getAuthErrorMessage(err) ?? undefined)
    }
  }

  return (
    <AnimatedScreen>
      <YStack flex={1} backgroundColor="$background" padding="$6" paddingTop="$8">
        <Heading size="$7">{dbUser?.displayName ?? 'User'}</Heading>
        <SizableText size="$3" color="$color6">
          {dbUser?.email ?? ''}
        </SizableText>

        <YStack marginTop="$6">
          <ThemeToggle />
        </YStack>

        <YStack flex={1} />

        <Button label="Sign Out" onPress={handleSignOut} variant="outline" />
      </YStack>
    </AnimatedScreen>
  )
}
