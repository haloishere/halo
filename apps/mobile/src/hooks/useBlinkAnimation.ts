import { useEffect } from 'react'
import {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

/**
 * Drives a looping opacity blink on a shared value and returns an animated
 * style ready for `Animated.View` / `Animated.Text`.
 *
 * Cancels the animation worklet on unmount to prevent UI-thread leaks.
 */
export function useBlinkAnimation(minOpacity: number, duration: number) {
  const opacity = useSharedValue(1)

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(minOpacity, { duration }), withTiming(1, { duration })),
      -1,
      false,
    )
    return () => cancelAnimation(opacity)
  }, [opacity, minOpacity, duration])

  return useAnimatedStyle(() => ({ opacity: opacity.value }))
}
