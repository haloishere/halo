import { Modal, Pressable, StyleSheet } from 'react-native'
import { Button, H4, Paragraph, Spinner, Theme, XStack, YStack } from 'tamagui'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  cancelLabel?: string
  confirmLabel: string
  variant?: 'default' | 'destructive'
  loading?: boolean
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel = 'Cancel',
  confirmLabel,
  variant = 'default',
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!loading) onOpenChange(false)
      }}
    >
      <Pressable
        style={styles.overlay}
        onPress={() => {
          if (!loading) onOpenChange(false)
        }}
        testID="confirm-dialog-overlay"
      >
        <Pressable
          accessible={false}
          style={styles.contentWrapper}
          onPress={(e) => e.stopPropagation()}
        >
          <YStack
            accessible
            accessibilityRole="alert"
            accessibilityLabel={title}
            backgroundColor="$background"
            borderRadius="$4"
            padding="$5"
            gap="$4"
            width="90%"
            maxWidth={400}
            elevation="$4"
          >
            <H4>{title}</H4>
            <Paragraph color="$color8">{description}</Paragraph>

            <XStack gap="$3" justifyContent="flex-end">
              <Button
                chromeless
                disabled={loading}
                onPress={() => onOpenChange(false)}
                accessibilityLabel={cancelLabel}
              >
                {cancelLabel}
              </Button>
              <Theme name={variant === 'destructive' ? 'error' : 'accent'}>
                <Button
                  disabled={loading}
                  opacity={loading ? 0.6 : 1}
                  onPress={onConfirm}
                  icon={loading ? <Spinner size="small" /> : undefined}
                  accessibilityLabel={confirmLabel}
                >
                  {confirmLabel}
                </Button>
              </Theme>
            </XStack>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%',
    alignItems: 'center',
  },
})
