'use client'

import { useRouter } from 'next/navigation'
import { ProductCreationDialog } from './product-creation-dialog'
import { ProductsTable } from './products-table'
import { Product } from '@/lib/products'

interface ProductsPageClientProps {
  products: Product[]
}

export function ProductsPageClient({ products }: ProductsPageClientProps) {
  const router = useRouter()

  const handleProductCreated = () => {
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground mt-1">
            Manage voice AI product tiers and pricing
          </p>
        </div>
        <ProductCreationDialog onProductCreated={handleProductCreated} />
      </div>
      
      <div className="border rounded-lg">
        <ProductsTable products={products} />
      </div>
    </div>
  )
}

