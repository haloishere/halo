import { z } from 'zod'

export const daydreamProductSchema = z.object({
  id: z.string(),
  brand: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  priceCents: z.number().int().nonnegative(),
  regularPriceCents: z.number().int().nonnegative(),
  onSale: z.boolean(),
  currency: z.literal('USD'),
  imageUrl: z.string(),
  sizesInStock: z.number().int(),
  sizesTotal: z.number().int(),
  shopUrl: z.string(),
})

export type DaydreamProduct = z.infer<typeof daydreamProductSchema>
