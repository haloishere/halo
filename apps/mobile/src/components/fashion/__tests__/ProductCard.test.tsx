import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Linking } from 'react-native'
import { render, fireEvent } from '../../../test/render'
import { ProductCard } from '../ProductCard'
import type { DaydreamProduct } from '@halo/shared'

const PRODUCT: DaydreamProduct = {
  id: 'prod-1',
  brand: 'Acme',
  name: 'Chelsea Boot',
  description: 'Brown leather',
  priceCents: 15000,
  regularPriceCents: 20000,
  onSale: true,
  currency: 'USD',
  imageUrl: 'https://cdn.example.com/boot.jpg',
  sizesInStock: 3,
  sizesTotal: 5,
  shopUrl: 'https://shop.example.com/boot',
}

const NO_IMAGE_PRODUCT: DaydreamProduct = {
  ...PRODUCT,
  id: 'prod-no-img',
  imageUrl: '',
}

const NO_BRAND_PRODUCT: DaydreamProduct = {
  ...PRODUCT,
  id: 'prod-no-brand',
  brand: null,
}

let openURLSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  openURLSpy = vi.spyOn(Linking, 'openURL').mockResolvedValue()
})

describe('ProductCard — rendering', () => {
  it('renders the product name', () => {
    const { getByText } = render(<ProductCard product={PRODUCT} />)
    expect(getByText('Chelsea Boot')).toBeTruthy()
  })

  it('renders the brand when present', () => {
    const { getByText } = render(<ProductCard product={PRODUCT} />)
    expect(getByText('ACME')).toBeTruthy()
  })

  it('renders gracefully when brand is null', () => {
    const { queryByText } = render(<ProductCard product={NO_BRAND_PRODUCT} />)
    expect(queryByText('Acme')).toBeNull()
  })

  it('renders the formatted price', () => {
    const { getByText } = render(<ProductCard product={PRODUCT} />)
    // $150.00 formatted from 15000 cents
    expect(getByText(/\$150/)).toBeTruthy()
  })

  it('renders a Shop button', () => {
    const { getByLabelText } = render(<ProductCard product={PRODUCT} />)
    expect(getByLabelText('Shop Chelsea Boot')).toBeTruthy()
  })

  it('does not crash when imageUrl is empty', () => {
    expect(() => render(<ProductCard product={NO_IMAGE_PRODUCT} />)).not.toThrow()
  })
})

describe('ProductCard — interactions', () => {
  it('opens the shop URL when Shop button is pressed', () => {
    const { getByLabelText } = render(<ProductCard product={PRODUCT} />)

    fireEvent.press(getByLabelText('Shop Chelsea Boot'))

    expect(openURLSpy).toHaveBeenCalledWith(PRODUCT.shopUrl)
  })
})
