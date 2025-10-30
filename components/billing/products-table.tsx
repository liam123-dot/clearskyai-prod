'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Product } from '@/lib/products'
import { Receipt, Repeat, Activity } from 'lucide-react'

interface ProductsTableProps {
  products: Product[]
}

export function ProductsTable({ products }: ProductsTableProps) {
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(cents / 100)
  }

  const getProductTypeBadge = (type: string) => {
    switch (type) {
      case 'one_time':
        return (
          <Badge variant="outline" className="gap-1">
            <Receipt className="h-3 w-3" />
            One-Time
          </Badge>
        )
      case 'recurring':
        return (
          <Badge variant="default" className="gap-1">
            <Repeat className="h-3 w-3" />
            Recurring
          </Badge>
        )
      case 'usage_based':
        return (
          <Badge variant="secondary" className="gap-1">
            <Activity className="h-3 w-3" />
            Usage-Based
          </Badge>
        )
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  const getProductDetails = (product: Product) => {
    switch (product.product_type) {
      case 'one_time':
        return <span className="text-muted-foreground">One-time payment</span>
      case 'recurring':
        const intervalText = product.interval_count > 1 
          ? `Every ${product.interval_count} ${product.interval}s`
          : `${product.interval}ly`
        const trialText = product.trial_days && product.trial_days > 0
          ? ` • ${product.trial_days} day trial`
          : ''
        return (
          <span className="text-muted-foreground">
            {intervalText.charAt(0).toUpperCase() + intervalText.slice(1)}
            {trialText}
          </span>
        )
      case 'usage_based':
        return (
          <span className="text-muted-foreground">
            {product.minutes_included?.toLocaleString()} min included, 
            then {formatCurrency(product.price_per_minute_cents || 0)}/min
          </span>
        )
      default:
        return '—'
    }
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No products created yet. Create your first product to get started.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Details</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id}>
            <TableCell>
              <div>
                <div className="font-medium">{product.name}</div>
                {product.description && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {product.description}
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell>{getProductTypeBadge(product.product_type)}</TableCell>
            <TableCell className="font-medium">
              {product.product_type === 'usage_based' ? (
                <span className="text-muted-foreground text-sm">Metered</span>
              ) : (
                <>
                  {formatCurrency(product.amount_cents)}
                  {product.product_type === 'recurring' && `/${product.interval}`}
                </>
              )}
            </TableCell>
            <TableCell className="text-sm">
              {getProductDetails(product)}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {new Date(product.created_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
