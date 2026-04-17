import { YStack } from 'tamagui'
import WebView from 'react-native-webview'

interface VideoEmbedProps {
  url: string
}

function getEmbedUrl(url: string): string | null {
  // YouTube: youtube.com/watch?v=ID or youtu.be/ID
  const ytMatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/u,
  )
  if (ytMatch?.[1]) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`
  }

  // Vimeo: vimeo.com/ID
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/u)
  if (vimeoMatch?.[1]) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`
  }

  return null
}

export function VideoEmbed({ url }: VideoEmbedProps) {
  const embedUrl = getEmbedUrl(url)
  if (!embedUrl) return null

  return (
    <YStack height={220} borderRadius="$4" overflow="hidden" marginBottom="$3">
      <WebView
        source={{ uri: embedUrl }}
        allowsFullscreenVideo
        javaScriptEnabled
        style={{ flex: 1 }}
      />
    </YStack>
  )
}
