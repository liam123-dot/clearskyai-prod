import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PropertiesTable } from './properties-table'
import { SyncButton } from './sync-button'
import { PromptSheet } from './prompt-sheet'
import { getProperties } from '@/lib/knowledge-bases'
import type { KnowledgeBase } from '@/lib/knowledge-bases'

interface EstateAgentViewProps {
  knowledgeBase: KnowledgeBase
  currentPage: number
  organizationSlug: string
}

export async function EstateAgentView({ knowledgeBase, currentPage, organizationSlug }: EstateAgentViewProps) {
  // Pagination
  const pageSize = 24
  const offset = (currentPage - 1) * pageSize

  // Fetch properties
  const allProperties = await getProperties(knowledgeBase.id)
  const totalCount = allProperties.length
  const paginatedProperties = allProperties.slice(offset, offset + pageSize)

  // Calculate summary statistics
  const rentalCount = allProperties.filter(p => p.transaction_type === 'rent').length
  const saleCount = allProperties.filter(p => p.transaction_type === 'sale').length
  const prices = allProperties.map(p => p.price).filter((p): p is number => p !== null && p !== undefined)
  const minPrice = prices.length > 0 ? Math.min(...prices) : null
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null
  const lastSynced = allProperties.length > 0 
    ? allProperties.reduce((latest, prop) => {
        const scrapedAt = new Date(prop.scraped_at).getTime()
        const latestTime = new Date(latest.scraped_at).getTime()
        return scrapedAt > latestTime ? prop : latest
      }).scraped_at
    : null

  // Format price
  const formatPrice = (price: number, transactionType: string) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price) + (transactionType === 'rent' ? '/month' : '')
  }

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  }

  return (
    <div className="space-y-6">
      {/* Sync Button */}
      <div className="flex justify-end gap-2">
        <PromptSheet 
          knowledgeBaseId={knowledgeBase.id}
          knowledgeBaseName={knowledgeBase.name}
        />
        <SyncButton 
          knowledgeBaseId={knowledgeBase.id} 
          organizationSlug={organizationSlug}
        />
      </div>

      {/* Properties Summary Card */}
      {totalCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Properties Summary</CardTitle>
            <CardDescription>Overview of synced properties</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Rental vs Sale */}
              <div>
                <p className="text-sm font-medium">Transaction Type</p>
                <div className="flex gap-4 mt-1">
                  {rentalCount > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {rentalCount} {rentalCount === 1 ? 'rental' : 'rentals'}
                    </p>
                  )}
                  {saleCount > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {saleCount} {saleCount === 1 ? 'sale' : 'sales'}
                    </p>
                  )}
                  {rentalCount === 0 && saleCount === 0 && (
                    <p className="text-sm text-muted-foreground">No properties</p>
                  )}
                </div>
              </div>

              {/* Price Range */}
              {minPrice !== null && maxPrice !== null && (
                <div>
                  <p className="text-sm font-medium">Price Range</p>
                  <p className="text-sm text-muted-foreground">
                    {(() => {
                      const rentalProps = allProperties.filter(p => p.transaction_type === 'rent')
                      const saleProps = allProperties.filter(p => p.transaction_type === 'sale')
                      const rentalPrices = rentalProps.map(p => p.price).filter((p): p is number => p !== null && p !== undefined)
                      const salePrices = saleProps.map(p => p.price).filter((p): p is number => p !== null && p !== undefined)
                      
                      const parts: string[] = []
                      if (rentalPrices.length > 0) {
                        const rentalMin = Math.min(...rentalPrices)
                        const rentalMax = Math.max(...rentalPrices)
                        if (rentalMin === rentalMax) {
                          parts.push(formatPrice(rentalMin, 'rent'))
                        } else {
                          parts.push(`${formatPrice(rentalMin, 'rent')} - ${formatPrice(rentalMax, 'rent')}`)
                        }
                      }
                      if (salePrices.length > 0) {
                        const saleMin = Math.min(...salePrices)
                        const saleMax = Math.max(...salePrices)
                        if (saleMin === saleMax) {
                          parts.push(formatPrice(saleMin, 'sale'))
                        } else {
                          parts.push(`${formatPrice(saleMin, 'sale')} - ${formatPrice(saleMax, 'sale')}`)
                        }
                      }
                      return parts.join(' | ')
                    })()}
                  </p>
                </div>
              )}

              {/* Last Synced */}
              {lastSynced && (
                <div>
                  <p className="text-sm font-medium">Last Synced</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(lastSynced)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Estate agent knowledge base settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(() => {
            const forSaleUrl = 'for_sale_url' in knowledgeBase.data && typeof knowledgeBase.data.for_sale_url === 'string' ? knowledgeBase.data.for_sale_url : null
            const rentalUrl = 'rental_url' in knowledgeBase.data && typeof knowledgeBase.data.rental_url === 'string' ? knowledgeBase.data.rental_url : null
            const resyncSchedule = 'resync_schedule' in knowledgeBase.data && typeof knowledgeBase.data.resync_schedule === 'string' ? knowledgeBase.data.resync_schedule : null
            
            return (
              <>
                {forSaleUrl && (
                  <div>
                    <p className="text-sm font-medium">For Sale URL</p>
                    <p className="text-sm text-muted-foreground break-all">
                      {forSaleUrl}
                    </p>
                  </div>
                )}
                {rentalUrl && (
                  <div>
                    <p className="text-sm font-medium">Rental URL</p>
                    <p className="text-sm text-muted-foreground break-all">
                      {rentalUrl}
                    </p>
                  </div>
                )}
                {resyncSchedule && (
                  <div>
                    <p className="text-sm font-medium">Re-sync Schedule</p>
                    <p className="text-sm text-muted-foreground">
                      {resyncSchedule === 'none' 
                        ? 'Manual sync only' 
                        : `Every ${resyncSchedule.replace('_', ' ')}`}
                    </p>
                  </div>
                )}
              </>
            )
          })()}
        </CardContent>
      </Card>

      {/* Properties Table */}
      <PropertiesTable
        properties={paginatedProperties}
        totalCount={totalCount}
        currentPage={currentPage}
        pageSize={pageSize}
      />
    </div>
  )
}

