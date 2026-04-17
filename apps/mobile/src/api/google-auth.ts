import { useMutation } from '@tanstack/react-query'
import { signInWithGoogle } from '../lib/google-auth'

export function useGoogleSignInMutation() {
  return useMutation({
    retry: false,
    mutationFn: async () => {
      const userCredential = await signInWithGoogle()
      if (!userCredential) return null
      return { uid: userCredential.user.uid }
    },
  })
}
