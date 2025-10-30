import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Badge } from '@/components/ui/badge'
import { IconBuilding } from '@tabler/icons-react'
import Image from 'next/image'
import type { Property } from '@/lib/knowledge-bases'

interface PropertiesTableProps {
  properties: Property[]
  totalCount: number
  currentPage: number
  pageSize: number
}

export function PropertiesTable({
  properties,
  totalCount,
  currentPage,
  pageSize,
}: PropertiesTableProps) {
  const offset = (currentPage - 1) * pageSize
  const showingFrom = totalCount > 0 ? offset + 1 : 0
  const showingTo = Math.min(offset + pageSize, totalCount)
  const totalPages = Math.ceil(totalCount / pageSize)

  // Format price
  const formatPrice = (price: number, transactionType: string) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price) + (transactionType === 'rent' ? '/mo' : '')
  }

  // Format date (relative or absolute)
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60))
        return diffMins <= 1 ? 'Just now' : `${diffMins}m ago`
      }
      return `${diffHours}h ago`
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays}d ago`
    } else {
      return new Intl.DateTimeFormat('en-GB', {
        month: 'short',
        day: 'numeric',
      }).format(date)
    }
  }

  if (totalCount === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconBuilding />
          </EmptyMedia>
          <EmptyTitle>No properties</EmptyTitle>
          <EmptyDescription>
            Properties will appear here once they are synced from RightMove
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {showingFrom} to {showingTo} of {totalCount} {totalCount === 1 ? 'property' : 'properties'}
        </p>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Image</TableHead>
              <TableHead className="min-w-[200px]">Property</TableHead>
              <TableHead className="w-20 text-center">Type</TableHead>
              <TableHead className="w-24 text-right">Price</TableHead>
              <TableHead className="w-28 text-right">Last Synced</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {properties.map((property) => {
              const imageUrl = property.original_data && 
                             typeof property.original_data === 'object' && 
                             'images' in property.original_data && 
                             Array.isArray(property.original_data.images) && 
                             property.original_data.images.length > 0
                ? property.original_data.images[0]
                : null

              return (
                <TableRow key={property.id}>
                  <TableCell className="p-2">
                    {imageUrl && typeof imageUrl === 'string' ? (
                      <div className="relative w-10 h-10 rounded overflow-hidden bg-muted">
                        <Image
                          src={imageUrl}
                          alt={property.title || 'Property'}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                        <IconBuilding className="size-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="p-2">
                    <div className="space-y-0.5">
                      <p className="font-medium text-sm line-clamp-1">
                        {property.title || property.full_address}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {property.full_address}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {property.beds !== null && <span>{property.beds}bd</span>}
                        {property.baths !== null && <span>•</span>}
                        {property.baths !== null && <span>{property.baths}ba</span>}
                        {property.property_type && <span>•</span>}
                        {property.property_type && <span className="truncate max-w-[100px]">{property.property_type}</span>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="p-2 text-center">
                    <Badge variant={property.transaction_type === 'rent' ? 'secondary' : 'default'} className="text-xs">
                      {property.transaction_type === 'rent' ? 'Rental' : 'Sale'}
                    </Badge>
                  </TableCell>
                  <TableCell className="p-2 text-right">
                    <span className="font-medium text-sm whitespace-nowrap">
                      {formatPrice(property.price, property.transaction_type)}
                    </span>
                  </TableCell>
                  <TableCell className="p-2 text-right">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(property.scraped_at)}
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <a
            href={currentPage > 1 ? `?page=${currentPage - 1}` : '#'}
            className={`px-3 py-1 rounded border ${
              currentPage > 1
                ? 'hover:bg-accent cursor-pointer'
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            Previous
          </a>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <a
            href={currentPage < totalPages ? `?page=${currentPage + 1}` : '#'}
            className={`px-3 py-1 rounded border ${
              currentPage < totalPages
                ? 'hover:bg-accent cursor-pointer'
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            Next
          </a>
        </div>
      )}
    </div>
  )
}

