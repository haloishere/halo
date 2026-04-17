import { useRef, useState } from 'react'
import { type TextInput as RNTextInput } from 'react-native'
import { Input as TamaguiInput, XStack, YStack, SizableText } from 'tamagui'

const CODE_LENGTH = 6

export interface OtpInputProps {
  onComplete: (code: string) => void
  error?: string
}

export function OtpInput({ onComplete, error }: OtpInputProps) {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const refs = useRef<(RNTextInput | null)[]>([])

  function handleChange(text: string, index: number) {
    // Handle paste of full code
    if (text.length === CODE_LENGTH && /^\d+$/.test(text)) {
      const pasted = text.split('')
      setDigits(pasted)
      refs.current[CODE_LENGTH - 1]?.focus()
      onComplete(text)
      return
    }

    // Reject non-numeric input
    const digit = text.slice(-1)
    if (digit && !/^\d$/.test(digit)) {
      return
    }

    const next = [...digits]
    next[index] = digit
    setDigits(next)

    if (digit && index < CODE_LENGTH - 1) {
      refs.current[index + 1]?.focus()
    } else if (!digit && index > 0) {
      // Backspace cleared this cell — move focus back
      refs.current[index - 1]?.focus()
    }

    // Check if all digits are filled
    if (digit && index === CODE_LENGTH - 1) {
      const code = next.join('')
      if (code.length === CODE_LENGTH) {
        // Blur last cell so border color updates, then fire completion
        refs.current[index]?.blur()
        setTimeout(() => onComplete(code), 0)
      }
    }
  }

  function handleKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits]
      next[index - 1] = ''
      setDigits(next)
      refs.current[index - 1]?.focus()
    }
  }

  return (
    <YStack gap="$2">
      <XStack gap="$2" justifyContent="center">
        {digits.map((digit, i) => (
          <TamaguiInput
            key={i}
            ref={(el) => {
              refs.current[i] = el as unknown as RNTextInput
            }}
            value={digit}
            onChangeText={(text) => handleChange(text, i)}
            onKeyPress={(e) => handleKeyPress(e.nativeEvent.key, i)}
            keyboardType="number-pad"
            maxLength={i === 0 ? CODE_LENGTH : 1}
            textAlign="center"
            width={48}
            height={56}
            borderWidth={1}
            borderColor={(error ? '$red9' : digit ? '$accent7' : '$color4') as '$color4'}
            borderRadius="$4"
            backgroundColor="$color2"
            fontSize={24}
            fontWeight="700"
            color="$color"
            accessibilityLabel={`digit ${i + 1}`}
          />
        ))}
      </XStack>
      {error && (
        <SizableText size="$3" color="$red11" textAlign="center">
          {error}
        </SizableText>
      )}
    </YStack>
  )
}
