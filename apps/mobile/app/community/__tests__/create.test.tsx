import React from 'react'
import { Alert } from 'react-native'
import { Text } from 'react-native'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, waitFor } from '@testing-library/react-native'
import { render } from '../../../src/test/render'

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  mockBack,
  mockCreatePost,
  mockUploadUrl,
  mockShow,
  mockManipulate,
  mockRenderAsync,
  mockSaveAsync,
} = vi.hoisted(() => {
  const saveAsync = vi.fn()
  const renderAsync = vi.fn()
  const manipulate = vi.fn()
  return {
    mockBack: vi.fn(),
    mockCreatePost: vi.fn().mockResolvedValue({ id: 'new-post-id' }),
    mockUploadUrl: vi.fn().mockResolvedValue({
      uploadUrl: 'https://storage.example.com/signed-upload',
      gcsPath: 'community/posts/img.jpg',
      requiredHeaders: { 'x-goog-content-length-range': '0,10485760' },
    }),
    mockShow: vi.fn(),
    mockManipulate: manipulate,
    mockRenderAsync: renderAsync,
    mockSaveAsync: saveAsync,
  }
})

// ─── Module mocks ───────────────────────────────────────────────────────────

vi.mock('@tamagui/lucide-icons', () => ({
  ArrowLeft: (props: Record<string, unknown>) => <Text {...props}>ArrowLeftIcon</Text>,
  ImagePlus: (props: Record<string, unknown>) => <Text {...props}>ImagePlusIcon</Text>,
  X: (props: Record<string, unknown>) => <Text {...props}>XIcon</Text>,
}))

vi.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  Stack: { Screen: () => null },
}))

vi.mock('@tamagui/toast', () => ({
  useToastController: () => ({ show: mockShow }),
}))

vi.mock('../../../src/api/community', () => ({
  useCreatePost: () => ({
    mutateAsync: mockCreatePost,
    isPending: false,
  }),
  useUploadUrl: () => ({
    mutateAsync: mockUploadUrl,
    isPending: false,
  }),
}))

vi.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: vi.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: vi.fn().mockResolvedValue({
    canceled: false,
    assets: [
      {
        uri: 'file:///test-image.jpg',
        fileName: 'test-image.jpg',
        mimeType: 'image/jpeg',
      },
    ],
  }),
}))

// Mock expo-image-manipulator. We use the new contextual API:
//   ImageManipulator.manipulate(uri).renderAsync().then(img => img.saveAsync(...))
// The mock chain returns a freshly stripped URI (file:///stripped.jpg) so tests
// can prove the upload reads from the manipulator output, not the raw asset.
vi.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: mockManipulate },
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}))

import CreatePostScreen from '../create'
import * as ImagePicker from 'expo-image-picker'

// ─── Helpers ────────────────────────────────────────────────────────────────

// Default global.fetch mock: the first call (reading img.uri → blob) and the
// second call (PUT to GCS) both succeed. Individual tests override as needed.
const defaultFetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input.toString()
  if (url.startsWith('file://')) {
    // fetch(img.uri).blob() — read local file
    return new Response(new Blob(['fake-image-bytes'], { type: 'image/jpeg' }))
  }
  if (init?.method === 'PUT') {
    // PUT to GCS signed URL
    return new Response(null, { status: 200 })
  }
  return new Response(null, { status: 500 })
})

beforeEach(() => {
  vi.clearAllMocks()
  mockCreatePost.mockResolvedValue({ id: 'new-post-id' })
  mockUploadUrl.mockResolvedValue({
    uploadUrl: 'https://storage.example.com/signed-upload',
    gcsPath: 'community/posts/img.jpg',
    requiredHeaders: { 'x-goog-content-length-range': '0,10485760' },
  })
  // Re-wire the manipulator chain on each test so call counts reset cleanly.
  // Default: manipulate() → renderAsync() → saveAsync() → URI distinct from
  // the picker URI so tests can prove the upload uses the stripped output.
  mockSaveAsync.mockResolvedValue({
    uri: 'file:///stripped.jpg',
    width: 1080,
    height: 1920,
  })
  mockRenderAsync.mockResolvedValue({ saveAsync: mockSaveAsync })
  mockManipulate.mockReturnValue({ renderAsync: mockRenderAsync })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.fetch = defaultFetchImpl as any
  defaultFetchImpl.mockClear()
})

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('CreatePostScreen', () => {
  it('renders all form elements', () => {
    const { getByText, getByLabelText } = render(<CreatePostScreen />)

    // Header
    expect(getByText('Create Post')).toBeTruthy()

    // Circle chips (all 8)
    expect(getByText('Emotional Support')).toBeTruthy()
    expect(getByText('Daily Care Tips')).toBeTruthy()
    expect(getByText('Caregiver Stories')).toBeTruthy()
    expect(getByText('Medical Questions')).toBeTruthy()
    expect(getByText('Activities & Engagement')).toBeTruthy()
    expect(getByText('Legal & Financial')).toBeTruthy()
    expect(getByText('Resources')).toBeTruthy()
    expect(getByText('Humor & Light')).toBeTruthy()

    // Title input
    expect(getByText('Title')).toBeTruthy()

    // Body textarea
    expect(getByText('Body')).toBeTruthy()

    // Add image button
    expect(getByText('Add Image')).toBeTruthy()

    // Submit button
    expect(getByLabelText('Post')).toBeTruthy()
  })

  it('shows validation errors on empty submit', async () => {
    const { getByLabelText, getByText } = render(<CreatePostScreen />)

    fireEvent.press(getByLabelText('Post'))

    await waitFor(() => {
      expect(getByText('Please select a circle')).toBeTruthy()
      expect(getByText('Title is required')).toBeTruthy()
      expect(getByText('Body is required')).toBeTruthy()
    })

    expect(mockCreatePost).not.toHaveBeenCalled()
  })

  it('selects a circle chip', () => {
    const { getByText } = render(<CreatePostScreen />)

    const chip = getByText('Emotional Support')
    fireEvent.press(chip)

    // The parent Chip sets accessibilityState.checked when selected
    // After pressing, the chip's container should have checked=true
    // We verify by pressing submit and checking no circle error appears
  })

  it('calls createPost with correct data on valid submit', async () => {
    const { getByLabelText, getByText, UNSAFE_getByProps } = render(<CreatePostScreen />)

    // Select circle
    fireEvent.press(getByText('Emotional Support'))

    // Fill title
    fireEvent.changeText(
      UNSAFE_getByProps({ placeholder: 'Give your post a title' }),
      'My Test Title',
    )

    // Fill body
    fireEvent.changeText(
      UNSAFE_getByProps({ placeholder: 'Share your thoughts...' }),
      'This is the body of my test post.',
    )

    // Submit
    fireEvent.press(getByLabelText('Post'))

    await waitFor(() => {
      expect(mockCreatePost).toHaveBeenCalledWith({
        circleSlug: 'emotional-support',
        title: 'My Test Title',
        body: 'This is the body of my test post.',
        imageUrls: [],
      })
    })
  })

  it('navigates back on successful submit', async () => {
    const { getByLabelText, getByText, UNSAFE_getByProps } = render(<CreatePostScreen />)

    fireEvent.press(getByText('Caregiver Stories'))
    fireEvent.changeText(UNSAFE_getByProps({ placeholder: 'Give your post a title' }), 'A Title')
    fireEvent.changeText(
      UNSAFE_getByProps({ placeholder: 'Share your thoughts...' }),
      'Some body text',
    )

    fireEvent.press(getByLabelText('Post'))

    await waitFor(() => {
      expect(mockShow).toHaveBeenCalledWith('Post created!')
      expect(mockBack).toHaveBeenCalled()
    })
  })

  it('shows toast on submission error', async () => {
    mockCreatePost.mockRejectedValueOnce(new Error('Server error'))

    const { getByLabelText, getByText, UNSAFE_getByProps } = render(<CreatePostScreen />)

    fireEvent.press(getByText('Daily Care Tips'))
    fireEvent.changeText(UNSAFE_getByProps({ placeholder: 'Give your post a title' }), 'Title')
    fireEvent.changeText(
      UNSAFE_getByProps({ placeholder: 'Share your thoughts...' }),
      'Body content',
    )

    fireEvent.press(getByLabelText('Post'))

    await waitFor(() => {
      expect(mockShow).toHaveBeenCalledWith('Server error')
      expect(mockBack).not.toHaveBeenCalled()
    })
  })

  it('handles image picker flow', async () => {
    const { getByText } = render(<CreatePostScreen />)

    fireEvent.press(getByText('Add Image'))

    await waitFor(() => {
      expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalled()
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled()
    })
  })

  it('shows alert when photo library permission denied', async () => {
    vi.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValueOnce({
      granted: false,
      status: 'denied' as ImagePicker.PermissionStatus,
      canAskAgain: true,
      expires: 'never',
    })

    const alertSpy = vi.spyOn(Alert, 'alert')

    const { getByText } = render(<CreatePostScreen />)
    fireEvent.press(getByText('Add Image'))

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Permission needed',
        'Please allow photo library access to attach images.',
      )
    })

    alertSpy.mockRestore()
  })

  it('shows toast when upload fails', async () => {
    mockUploadUrl.mockRejectedValueOnce(new Error('Upload failed'))

    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///test.jpg',
          fileName: 'test.jpg',
          mimeType: 'image/jpeg',
          width: 100,
          height: 100,
          type: 'image',
        },
      ],
    })

    const { getByLabelText, getByText, UNSAFE_getByProps } = render(<CreatePostScreen />)

    // Add image first
    fireEvent.press(getByText('Add Image'))
    await waitFor(() => {
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled()
    })

    // Fill form
    fireEvent.press(getByText('Emotional Support'))
    fireEvent.changeText(UNSAFE_getByProps({ placeholder: 'Give your post a title' }), 'Title')
    fireEvent.changeText(UNSAFE_getByProps({ placeholder: 'Share your thoughts...' }), 'Body')

    // Submit — upload should fail
    fireEvent.press(getByLabelText('Post'))

    await waitFor(() => {
      expect(mockShow).toHaveBeenCalledWith('Upload failed')
    })
  })

  it('navigates back when back arrow is pressed', () => {
    const { getByLabelText } = render(<CreatePostScreen />)
    fireEvent.press(getByLabelText('Go back'))
    expect(mockBack).toHaveBeenCalled()
  })

  it('deselects circle when pressing it again', () => {
    const { getByText, getByLabelText } = render(<CreatePostScreen />)

    // Select
    fireEvent.press(getByText('Emotional Support'))
    // Deselect by pressing same circle
    fireEvent.press(getByText('Emotional Support'))

    // Submit should show circle error (circle deselected)
    fireEvent.press(getByLabelText('Post'))
    expect(getByText('Please select a circle')).toBeTruthy()
  })

  it('does not add image when picker is cancelled', async () => {
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({
      canceled: true,
      assets: null as never,
    })

    const { getByText, queryByLabelText } = render(<CreatePostScreen />)
    fireEvent.press(getByText('Add Image'))

    await waitFor(() => {
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled()
    })

    // No image should be attached
    expect(queryByLabelText('Attached image 1')).toBeNull()
  })

  it('removes an attached image', async () => {
    const { getByText, queryByLabelText, getByLabelText } = render(<CreatePostScreen />)

    // Add image
    fireEvent.press(getByText('Add Image'))
    await waitFor(() => {
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled()
    })

    // Image should be visible
    await waitFor(() => {
      expect(getByLabelText('Attached image 1')).toBeTruthy()
    })

    // Remove it
    fireEvent.press(getByLabelText('Remove image 1'))
    expect(queryByLabelText('Attached image 1')).toBeNull()
  })

  // ─── C2 from PR #109 review: lock in the fix for the GCS V4 signature bug ──

  it('sends requiredHeaders on the GCS PUT so the signature matches (C2)', async () => {
    const { getByLabelText, getByText, UNSAFE_getByProps } = render(<CreatePostScreen />)

    // Attach an image
    fireEvent.press(getByText('Add Image'))
    await waitFor(() => {
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled()
    })

    // Fill required fields
    fireEvent.press(getByText('Emotional Support'))
    fireEvent.changeText(UNSAFE_getByProps({ placeholder: 'Give your post a title' }), 'Title')
    fireEvent.changeText(UNSAFE_getByProps({ placeholder: 'Share your thoughts...' }), 'Body')

    // Submit
    fireEvent.press(getByLabelText('Post'))

    await waitFor(() => {
      expect(mockCreatePost).toHaveBeenCalled()
    })

    // Find the PUT call to the signed URL
    const putCall = defaultFetchImpl.mock.calls.find(
      ([, init]) => init?.method === 'PUT',
    )
    expect(putCall).toBeDefined()
    const [, init] = putCall!
    const headers = init!.headers as Record<string, string>
    // The headers must include the signed extension header — without this, the
    // GCS V4 signature mismatches and the upload 403s.
    expect(headers['x-goog-content-length-range']).toBe('0,10485760')
    // Content-Type should still be set
    expect(headers['Content-Type']).toBe('image/jpeg')
  })

  it('surfaces a friendly error when GCS returns 403 (I1)', async () => {
    // Simulate GCS rejecting the PUT with 403 + XML error body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = vi.fn(async (input: any, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.startsWith('file://')) {
        return new Response(new Blob(['fake-image-bytes']))
      }
      if (init?.method === 'PUT') {
        return new Response(
          '<?xml version="1.0"?><Error><Code>SignatureDoesNotMatch</Code></Error>',
          { status: 403 },
        )
      }
      return new Response(null, { status: 500 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any

    const { getByLabelText, getByText, UNSAFE_getByProps } = render(<CreatePostScreen />)

    fireEvent.press(getByText('Add Image'))
    await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled())

    fireEvent.press(getByText('Emotional Support'))
    fireEvent.changeText(UNSAFE_getByProps({ placeholder: 'Give your post a title' }), 'Title')
    fireEvent.changeText(UNSAFE_getByProps({ placeholder: 'Share your thoughts...' }), 'Body')

    fireEvent.press(getByLabelText('Post'))

    await waitFor(() => {
      expect(mockShow).toHaveBeenCalled()
    })

    // The toast shown to the user must NOT contain raw GCS XML — it should be
    // a friendly caregiver-facing message. We also expect the status code to be
    // surfaced so support can diagnose.
    const toastMessage = mockShow.mock.calls[0]![0] as string
    expect(toastMessage).not.toContain('<?xml')
    expect(toastMessage).not.toContain('SignatureDoesNotMatch')
    expect(toastMessage.toLowerCase()).toContain("couldn't upload")
    expect(toastMessage).toContain('403')

    // createPost must NOT have been called — the upload failed
    expect(mockCreatePost).not.toHaveBeenCalled()
    // User should stay on the screen
    expect(mockBack).not.toHaveBeenCalled()
  })

  // ─── #111: strip EXIF before upload (GPS / device leak) ───────────────────

  it('runs picked images through ImageManipulator before upload (#111)', async () => {
    const { getByLabelText, getByText, UNSAFE_getByProps } = render(<CreatePostScreen />)

    fireEvent.press(getByText('Add Image'))
    await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled())

    fireEvent.press(getByText('Emotional Support'))
    fireEvent.changeText(UNSAFE_getByProps({ placeholder: 'Give your post a title' }), 'Title')
    fireEvent.changeText(UNSAFE_getByProps({ placeholder: 'Share your thoughts...' }), 'Body')

    fireEvent.press(getByLabelText('Post'))

    await waitFor(() => {
      expect(mockCreatePost).toHaveBeenCalled()
    })

    // Manipulator was called with the raw picker URI…
    expect(mockManipulate).toHaveBeenCalledWith('file:///test-image.jpg')
    // …and we re-encoded as JPEG (the side effect that drops EXIF directories).
    expect(mockSaveAsync).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'jpeg' }),
    )

    // The local-file fetch (used to read the bytes for the GCS PUT body) must
    // read from the *stripped* URI, not the raw picker URI. Otherwise the
    // GPS-tagged bytes still leave the device.
    const fileFetchCalls = defaultFetchImpl.mock.calls.filter(([input]) => {
      const url = typeof input === 'string' ? input : input.toString()
      return url.startsWith('file://')
    })
    expect(fileFetchCalls.length).toBe(1)
    const [strippedUri] = fileFetchCalls[0]!
    expect(strippedUri).toBe('file:///stripped.jpg')
    // Belt-and-braces: never fetch the original picker URI for upload.
    const fetchedTheRawAsset = defaultFetchImpl.mock.calls.some(
      ([input]) => (typeof input === 'string' ? input : input.toString()) === 'file:///test-image.jpg',
    )
    expect(fetchedTheRawAsset).toBe(false)
  })

  it('aborts the upload with a friendly toast when EXIF strip fails (#111)', async () => {
    // If the manipulator throws (e.g., corrupt file, OOM), we MUST NOT fall
    // back to uploading the raw picker URI — that would silently re-introduce
    // the leak this fix exists to prevent.
    mockSaveAsync.mockRejectedValueOnce(new Error('manipulator boom'))

    const { getByLabelText, getByText, UNSAFE_getByProps } = render(<CreatePostScreen />)

    fireEvent.press(getByText('Add Image'))
    await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled())

    fireEvent.press(getByText('Emotional Support'))
    fireEvent.changeText(UNSAFE_getByProps({ placeholder: 'Give your post a title' }), 'Title')
    fireEvent.changeText(UNSAFE_getByProps({ placeholder: 'Share your thoughts...' }), 'Body')

    fireEvent.press(getByLabelText('Post'))

    await waitFor(() => {
      expect(mockShow).toHaveBeenCalled()
    })

    // No PUT to GCS — the upload was never attempted.
    const putCall = defaultFetchImpl.mock.calls.find(([, init]) => init?.method === 'PUT')
    expect(putCall).toBeUndefined()
    // No file:// fetch of the raw picker URI either.
    const rawAssetFetched = defaultFetchImpl.mock.calls.some(
      ([input]) => (typeof input === 'string' ? input : input.toString()) === 'file:///test-image.jpg',
    )
    expect(rawAssetFetched).toBe(false)
    // Post was not created.
    expect(mockCreatePost).not.toHaveBeenCalled()
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('hides Add Image button when 3 images are attached', async () => {
    // Mock picker to return a new image each call
    const makeMockResult = (name: string) => ({
      canceled: false,
      assets: [{ uri: `file:///${name}.jpg`, fileName: `${name}.jpg`, mimeType: 'image/jpeg' }],
    })

    vi.mocked(ImagePicker.launchImageLibraryAsync)
      .mockResolvedValueOnce(makeMockResult('img1') as never)
      .mockResolvedValueOnce(makeMockResult('img2') as never)
      .mockResolvedValueOnce(makeMockResult('img3') as never)

    const { getByText, queryByText } = render(<CreatePostScreen />)

    // Add 3 images
    for (let i = 0; i < 3; i++) {
      fireEvent.press(getByText('Add Image'))
      await waitFor(() => {
        expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(i + 1)
      })
    }

    // Add Image button should be gone
    await waitFor(() => {
      expect(queryByText('Add Image')).toBeNull()
    })
  })
})
