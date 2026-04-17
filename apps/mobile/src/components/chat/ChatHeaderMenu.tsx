import { useState, useCallback } from 'react'
import { Modal, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { XStack, YStack, SizableText } from 'tamagui'
import { Plus, MessageSquarePlus, History } from '@tamagui/lucide-icons'
import { HEADER_BAR_HEIGHT } from '../ui/constants'

export interface ChatHeaderMenuProps {
  onNewChat: () => void
  onHistory: () => void
}

export function ChatHeaderMenu({ onNewChat, onHistory }: ChatHeaderMenuProps) {
  const [open, setOpen] = useState(false)
  const insets = useSafeAreaInsets()

  const close = useCallback(() => setOpen(false), [])

  const handleNewChat = useCallback(() => {
    close()
    onNewChat()
  }, [close, onNewChat])

  const handleHistory = useCallback(() => {
    close()
    onHistory()
  }, [close, onHistory])

  return (
    <>
      <XStack
        accessibilityRole="button"
        accessibilityLabel="Chat menu"
        onPress={() => setOpen(true)}
        pressStyle={{ opacity: 0.7 }}
        padding="$1"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Plus size={22} color="$color" />
      </XStack>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable
          style={[styles.overlay, { paddingTop: insets.top + HEADER_BAR_HEIGHT }]}
          onPress={close}
          testID="chat-header-menu-overlay"
        >
          <Pressable
            accessible={false}
            style={styles.menuWrapper}
            onPress={(e) => e.stopPropagation()}
          >
            <YStack
              backgroundColor="$background"
              borderRadius="$4"
              borderWidth={1}
              borderColor="$borderColor"
              elevation="$4"
              minWidth={200}
              overflow="hidden"
            >
              <MenuItem
                label="New Chat"
                icon={<MessageSquarePlus size={18} color="$color" />}
                onPress={handleNewChat}
              />
              <YStack height={1} backgroundColor="$borderColor" />
              <MenuItem
                label="Chat History"
                icon={<History size={18} color="$color" />}
                onPress={handleHistory}
              />
            </YStack>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

interface MenuItemProps {
  label: string
  icon: React.ReactNode
  onPress: () => void
}

function MenuItem({ label, icon, onPress }: MenuItemProps) {
  return (
    <XStack
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      pressStyle={{ backgroundColor: '$color3' }}
      paddingHorizontal="$4"
      paddingVertical="$3.5"
      gap="$3"
      alignItems="center"
    >
      {icon}
      <SizableText size="$4">{label}</SizableText>
    </XStack>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingRight: 12,
  },
  menuWrapper: {
    alignItems: 'flex-end',
  },
})
