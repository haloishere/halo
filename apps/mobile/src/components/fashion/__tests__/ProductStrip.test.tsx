import { describe, it, expect } from 'vitest'
import { render } from '../../../test/render'
import { ProductStrip } from '../ProductStrip'
import type { DaydreamProduct } from '@halo/shared'

function makeProduct(id: string): DaydreamProduct {
  return {
    id,
    brand: 'Brand',
    name: `Product ${id}`,
    description: null,
    priceCents: 9900,
    regularPriceCents: 9900,
    onSale: false,
    currency: 'USD',
    imageUrl: `https://cdn.example.com/${id}.jpg`,
    sizesInStock: 1,
    sizesTotal: 2,
    shopUrl: `https://shop.example.com/${id}`,
  }
}

const TWENTY_PRODUCTS = Array.from({ length: 20 }, (_, i) => makeProduct(`p${i + 1}`))

describe('ProductStrip — rendering', () => {
  it('renders without crashing with 20 products', () => {
    expect(() => render(<ProductStrip products={TWENTY_PRODUCTS} />)).not.toThrow()
  })

  it('renders the first product name', () => {
    const { getByText } = render(<ProductStrip products={TWENTY_PRODUCTS} />)
    expect(getByText('Product p1')).toBeTruthy()
  })

  it('renders nothing when products array is empty', () => {
    const { queryByText } = render(<ProductStrip products={[]} />)
    expect(queryByText(/Product/)).toBeNull()
  })
})
