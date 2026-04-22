import { FlatList, StyleSheet } from 'react-native'
import { YStack } from 'tamagui'
import type { DaydreamProduct } from '@halo/shared'
import { ProductCard } from './ProductCard'

const styles = StyleSheet.create({
  contentContainer: { gap: 10, paddingHorizontal: 4 },
})

export interface ProductStripProps {
  products: DaydreamProduct[]
}

export function ProductStrip({ products }: ProductStripProps) {
  if (products.length === 0) return null

  return (
    <YStack marginVertical="$2">
      <FlatList
        data={products}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.contentContainer}
        renderItem={({ item }) => <ProductCard product={item} />}
      />
    </YStack>
  )
}
