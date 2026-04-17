import { useState, useCallback } from 'react'
import { Alert, Image } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { useToastController } from '@tamagui/toast'
import { XStack, YStack, SizableText, TextArea, Label } from 'tamagui'
import { ImagePlus, X } from '@tamagui/lucide-icons'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { COMMUNITY_CIRCLES, type CommunityCircle, createPostSchema } from '@halo/shared'
import { useCreatePost, useUploadUrl } from '../../src/api/community'
import { getCircleLabel } from '../../src/lib/community-utils'
import { AnimatedScreen, Button, Chip, Input, ScreenContainer } from '../../src/components/ui'
import { HeaderBar } from '../../src/components/ui/HeaderBar'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
const MAX_IMAGES = 3

interface PickedImage {
  uri: string
  filename: string
  mimeType: string
}

export default function CreatePostScreen() {
  const router = useRouter()
  const toastCtrl = useToastController()
  const createPost = useCreatePost()
  const uploadUrl = useUploadUrl()

  const [circleSlug, setCircleSlug] = useState<CommunityCircle | undefined>()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [images, setImages] = useState<PickedImage[]>([])
  const [errors, setErrors] = useState<{ circle?: string; title?: string; body?: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [bodyFocused, setBodyFocused] = useState(false)

  const handleCircleSelect = useCallback((slug: CommunityCircle) => {
    setCircleSlug((prev) => (prev === slug ? undefined : slug))
    setErrors((prev) => ({ ...prev, circle: undefined }))
  }, [])

  const handleAddImage = useCallback(async () => {
    if (images.length >= MAX_IMAGES) return

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to attach images.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: false,
    })

    if (result.canceled || !result.assets[0]) return

    const asset = result.assets[0]
    const mimeType = asset.mimeType ?? 'image/jpeg'

    if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      Alert.alert('Unsupported format', 'Please choose a JPEG, PNG, WebP, or HEIC image.')
      return
    }

    const filename = asset.fileName ?? `image-${Date.now()}.jpg`
    setImages((prev) => [...prev, { uri: asset.uri, filename, mimeType }])
  }, [images.length])

  const handleRemoveImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleSubmit = useCallback(async () => {
    const result = createPostSchema.safeParse({
      circleSlug: circleSlug ?? '',
      title: title.trim(),
      body: body.trim(),
      imageUrls: [],
    })

    if (!result.success) {
      const fieldErrors = new Set(result.error.issues.map((i) => i.path[0]))
      setErrors({
        circle: fieldErrors.has('circleSlug') ? 'Please select a circle' : undefined,
        title: fieldErrors.has('title') ? 'Title is required' : undefined,
        body: fieldErrors.has('body') ? 'Body is required' : undefined,
      })
      return
    }
    setErrors({})
    setIsSubmitting(true)

    try {
      // Upload images to GCS via signed URLs (parallel)
      const imageUrls = await Promise.all(
        images.map(async (img) => {
          // ─── #111: strip EXIF before the bytes leave the device ──────────
          // expo-image-picker preserves EXIF (GPS, device build, capture
          // datetime) even with `quality: 0.8`, because that param only
          // re-encodes the JPEG bitrate. Routing the URI through
          // ImageManipulator with a no-op + JPEG re-encode drops every EXIF
          // directory as a side effect of the re-encode pipeline.
          //
          // Trade-off: PNG/WebP/HEIC inputs are normalised to JPEG. For a
          // caregiver community feed of camera photos this is acceptable.
          // If the strip throws (corrupt file, OOM), we MUST fail the upload
          // entirely rather than fall back to the raw URI — falling back
          // would silently re-leak the data this fix exists to protect.
          const stripped = await ImageManipulator.manipulate(img.uri)
            .renderAsync()
            .then((ref) => ref.saveAsync({ compress: 0.8, format: SaveFormat.JPEG }))

          // After the strip, the bytes are always JPEG. Ask the API for a
          // signed URL with that exact content type so the GCS path extension
          // and the V4 signature both line up with what we're about to PUT.
          const {
            uploadUrl: signedUrl,
            gcsPath,
            requiredHeaders,
          } = await uploadUrl.mutateAsync({
            filename: img.filename,
            contentType: 'image/jpeg',
          })

          // Read the *stripped* local file into a Blob. If this fails (e.g.,
          // cache evicted, manipulator output unreadable), surface a specific
          // error instead of a cryptic "Network request failed" downstream.
          let blob: Blob
          try {
            const fileResponse = await fetch(stripped.uri)
            blob = await fileResponse.blob()
          } catch {
            throw new Error('Could not read the selected image. Please pick it again.')
          }

          // Spread signed headers FIRST so an explicit Content-Type below
          // cannot be silently overridden by a same-name key from the server
          // response. GCS V4 signed URLs commit to a specific set of signed
          // headers at signing time (Content-Type plus everything in
          // extensionHeaders) — the client must echo each one exactly, or
          // GCS returns 403 SignatureDoesNotMatch.
          const uploadRes = await fetch(signedUrl, {
            method: 'PUT',
            headers: {
              ...requiredHeaders,
              'Content-Type': 'image/jpeg',
            },
            body: blob,
          })

          if (!uploadRes.ok) {
            // Log the raw GCS body for developer diagnostics; never show it
            // to caregivers — they get a friendly toast below. XML error
            // bodies from GCS (SignatureDoesNotMatch, etc.) are not useful
            // to end users and may leak internal infra structure.
            const detail = await uploadRes.text().catch(() => '<unreadable>')
            // eslint-disable-next-line no-console
            console.warn(
              '[community/create] GCS PUT failed',
              JSON.stringify({ status: uploadRes.status, detail: detail.slice(0, 500) }),
            )
            throw new Error(
              `Couldn't upload image (${uploadRes.status}). Please try again.`,
            )
          }
          return gcsPath
        }),
      )

      await createPost.mutateAsync({
        circleSlug: circleSlug!,
        title: title.trim(),
        body: body.trim(),
        imageUrls,
      })

      toastCtrl.show('Post created!')
      router.back()
    } catch (err) {
      // Every path that throws above produces a user-friendly message:
      //  - upload errors are rewritten to caregiver-facing strings
      //  - createPost mutation errors bubble up with their own .message
      //  - unknown shapes fall back to a generic message
      const message = err instanceof Error ? err.message : 'Could not create post'
      toastCtrl.show(message)
    } finally {
      setIsSubmitting(false)
    }
  }, [circleSlug, title, body, images, createPost, uploadUrl, toastCtrl, router])

  return (
    <AnimatedScreen>
      <Stack.Screen options={{ headerShown: false }} />
      <HeaderBar showBack title="Create Post" />
      <ScreenContainer
        footer={
          <Button
            label="Post"
            onPress={handleSubmit}
            disabled={isSubmitting}
            loading={isSubmitting}
            variant="primary"
          />
        }
      >
        {/* Circle picker */}
        <YStack gap="$2" marginBottom="$4">
          <Label size="$3" fontWeight="500" color="$color">
            Circle
          </Label>
          <XStack flexWrap="wrap" gap="$2">
            {COMMUNITY_CIRCLES.map((slug) => (
              <Chip
                key={slug}
                label={getCircleLabel(slug)}
                selected={circleSlug === slug}
                onPress={() => handleCircleSelect(slug)}
              />
            ))}
          </XStack>
          {errors.circle && (
            <SizableText size="$3" color="$red11">
              {errors.circle}
            </SizableText>
          )}
        </YStack>

        {/* Title */}
        <YStack marginBottom="$4">
          <Input
            label="Title"
            placeholder="Give your post a title"
            value={title}
            onChangeText={(text) => {
              setTitle(text)
              setErrors((prev) => ({ ...prev, title: undefined }))
            }}
            maxLength={200}
            error={errors.title}
          />
          <SizableText size="$1" color="$color6" textAlign="right" marginTop="$1">
            {title.length}/200
          </SizableText>
        </YStack>

        {/* Body */}
        <YStack gap="$1.5" marginBottom="$4">
          <Label size="$3" fontWeight="500" color="$color">
            Body
          </Label>
          <TextArea
            placeholder="Share your thoughts..."
            value={body}
            onChangeText={(text) => {
              setBody(text)
              setErrors((prev) => ({ ...prev, body: undefined }))
            }}
            maxLength={5000}
            minHeight={120}
            borderWidth={1.5}
            borderColor={
              (errors.body ? '$red9' : bodyFocused ? '$accent7' : '$color6') as '$color4'
            }
            borderRadius="$6"
            paddingHorizontal="$5"
            paddingVertical="$3"
            backgroundColor="$color1"
            size="$5"
            color="$color"
            placeholderTextColor="$color6"
            onFocus={() => setBodyFocused(true)}
            onBlur={() => setBodyFocused(false)}
          />
          {errors.body && (
            <SizableText size="$3" color="$red11">
              {errors.body}
            </SizableText>
          )}
          <SizableText size="$1" color="$color6" textAlign="right">
            {body.length}/5000
          </SizableText>
        </YStack>

        {/* Images */}
        <YStack gap="$2">
          <Label size="$3" fontWeight="500" color="$color">
            Images (optional)
          </Label>

          {images.length > 0 && (
            <XStack gap="$2" flexWrap="wrap">
              {images.map((img, i) => (
                <YStack key={img.uri} position="relative">
                  <Image
                    source={{ uri: img.uri }}
                    style={{ width: 80, height: 80, borderRadius: 8 }}
                    accessibilityLabel={`Attached image ${i + 1}`}
                  />
                  <XStack
                    position="absolute"
                    top={-6}
                    right={-6}
                    width={22}
                    height={22}
                    borderRadius={11}
                    backgroundColor="$color8"
                    alignItems="center"
                    justifyContent="center"
                    onPress={() => handleRemoveImage(i)}
                    pressStyle={{ opacity: 0.7 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove image ${i + 1}`}
                  >
                    <X size={12} color="$color1" />
                  </XStack>
                </YStack>
              ))}
            </XStack>
          )}

          {images.length < MAX_IMAGES && (
            <XStack>
              <Button
                label="Add Image"
                onPress={handleAddImage}
                variant="outline"
                icon={<ImagePlus size={18} color="$color" />}
              />
            </XStack>
          )}
        </YStack>
      </ScreenContainer>
    </AnimatedScreen>
  )
}
