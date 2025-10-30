import { ProductsPageClient } from '@/components/billing/products-page-client'
import { getProducts } from '@/lib/products'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Products",
}

export default async function AdminProductsPage() {
  const products = await getProducts()

  return <ProductsPageClient products={products} />
}