import { Alert, Linking } from 'react-native'
import { styled, YStack, Text, Button, Theme } from 'tamagui'
import { Phone } from '@tamagui/lucide-icons'

// Tamagui v2 RC type gap: `animation` not in styled() props — spread workaround still needed
const cardAnimProps = {
  animation: 'quick',
  enterStyle: { opacity: 0, scale: 0.97 },
  exitStyle: { opacity: 0, scale: 0.97 },
} as Record<string, unknown>

const CrisisCard = styled(YStack, {
  backgroundColor: '$red3',
  borderRadius: '$4',
  padding: '$4',
  marginHorizontal: '$3',
  marginVertical: '$2',
  gap: '$2',
  opacity: 1,
  scale: 1,
  ...cardAnimProps,
})

const CrisisHeading = styled(Text, {
  fontWeight: 'bold',
  color: '$red11',
  fontSize: '$4',
})

const CrisisDescription = styled(Text, {
  color: '$red11',
  fontSize: '$3',
})

// Tamagui v2 RC type gap: `color` not in styled(Button) props — spread workaround still needed
const crisisButtonStyle = {
  backgroundColor: '$color9',
  color: '$color1',
} as Record<string, unknown>

interface CrisisActionProps {
  label: string
  url: string
  showPhoneIcon?: boolean
}

function CrisisAction({ label, url, showPhoneIcon = false }: CrisisActionProps) {
  return (
    <Button
      size="$3"
      onPress={() =>
        Linking.openURL(url).catch(() =>
          Alert.alert('Could not open link', 'Please dial the number manually.'),
        )
      }
      icon={showPhoneIcon ? <Phone size={16} color="$color1" /> : undefined}
      {...crisisButtonStyle}
    >
      {label}
    </Button>
  )
}

export function CrisisResources() {
  return (
    <CrisisCard>
      <CrisisHeading>Crisis Resources</CrisisHeading>
      <CrisisDescription>
        If you or someone you know is in crisis, please reach out:
      </CrisisDescription>

      <Theme name="error">
        <CrisisAction label="988 Suicide & Crisis Lifeline" url="tel:988" showPhoneIcon />
        <CrisisAction label="Crisis Text Line: Text HOME to 741741" url="sms:741741?body=HOME" />
        <CrisisAction
          label="Adult Protective Services: 1-800-677-1116"
          url="tel:18006771116"
          showPhoneIcon
        />
      </Theme>
    </CrisisCard>
  )
}
