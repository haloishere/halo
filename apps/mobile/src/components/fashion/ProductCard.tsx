import { Image, Linking } from 'react-native'
import { SizableText, XStack, YStack } from 'tamagui'
import type { DaydreamProduct } from '@halo/shared'
import { Button } from '../ui'

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100)
}

export interface ProductCardProps {
  product: DaydreamProduct
}

export function ProductCard({ product }: ProductCardProps) {
  const { brand, name, priceCents, currency, imageUrl, shopUrl } = product

  return (
    <YStack
      width={160}
      borderRadius="$3"
      backgroundColor="$color2"
      overflow="hidden"
      pressStyle={{ opacity: 0.9 }}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: 160, height: 160 }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <YStack width={160} height={160} backgroundColor="$color4" />
      )}

      <YStack padding="$2.5" gap="$1">
        {brand ? (
          <SizableText size="$1" color="$color9" numberOfLines={1}>
            {brand.toUpperCase()}
          </SizableText>
        ) : null}

        <SizableText size="$3" fontWeight="600" numberOfLines={2}>
          {name}
        </SizableText>

        <XStack alignItems="center" gap="$2" marginTop="$1">
          <SizableText size="$3" color="$accent9" fontWeight="700">
            {formatPrice(priceCents, currency)}
          </SizableText>
        </XStack>

        <Button
          variant="primary"
          label="Shop"
          accessibilityLabel={`Shop ${name}`}
          onPress={() => {
            Linking.openURL(shopUrl).catch(() => {})
          }}
        />
      </YStack>
    </YStack>
  )
}
