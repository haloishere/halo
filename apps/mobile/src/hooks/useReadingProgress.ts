import { useCallback, useEffect, useRef, useState } from 'react'
import { useUpdateProgress } from '../api/content'

interface ScrollEvent {
  nativeEvent: {
    contentOffset: { y: number }
    contentSize: { height: number }
    layoutMeasurement: { height: number }
  }
}

const SAVE_THRESHOLD = 10 // Save when progress increases by >= 10%

export function useReadingProgress(contentItemId: string, initialProgress: number) {
  const [progress, setProgress] = useState(initialProgress)
  const lastSavedRef = useRef(initialProgress)
  const progressRef = useRef(initialProgress)
  const updateProgress = useUpdateProgress()

  // Sync refs when article loads asynchronously (initialProgress goes from 0 → actual)
  useEffect(() => {
    if (initialProgress > progressRef.current) {
      progressRef.current = initialProgress
      lastSavedRef.current = initialProgress
      setProgress(initialProgress)
    }
  }, [initialProgress])

  const onScroll = useCallback(
    (event: ScrollEvent) => {
      if (!contentItemId) return

      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent
      const scrollableHeight = contentSize.height - layoutMeasurement.height
      if (scrollableHeight <= 0) return

      const scrollPercent = Math.min(100, Math.round((contentOffset.y / scrollableHeight) * 100))
      const newProgress = Math.max(progressRef.current, scrollPercent)

      if (newProgress === progressRef.current) return
      progressRef.current = newProgress
      setProgress(newProgress)

      // Save when threshold reached or completed
      if (
        newProgress - lastSavedRef.current >= SAVE_THRESHOLD ||
        (newProgress >= 100 && lastSavedRef.current < 100)
      ) {
        lastSavedRef.current = newProgress
        updateProgress.mutate(
          { contentItemId, progressPercent: newProgress },
          {
            onError: () => {
              // Reset so it retries on next threshold cross
              lastSavedRef.current = newProgress - SAVE_THRESHOLD
            },
          },
        )
      }
    },
    [contentItemId, updateProgress],
  )

  return { progress, onScroll }
}
