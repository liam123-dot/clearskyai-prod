'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PropertiesTable } from './properties-table'
import { SyncButton } from './sync-button'
import { PromptSheet } from './prompt-sheet'
import { LocationDataSheet } from './location-data-sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import type { KnowledgeBase, Property } from '@/lib/knowledge-bases'

interface EstateAgentViewProps {
  knowledgeBase: KnowledgeBase
  organizationSlug: string
}

interface SummaryData {
  rentalCount: number
  saleCount: number
  rentalMinPrice: number | null
  rentalMaxPrice: number | null
  saleMinPrice: number | null
  saleMaxPrice: number | null
  lastSynced: string | null
  totalCount: number
}

interface PropertiesData {
  properties: Property[]
  pagination: {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
  }
}

export function EstateAgentView({ knowledgeBase, organizationSlug }: EstateAgentViewProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const pageSize = 24
  const currentPage = parseInt(searchParams.get('page') || '1', 10)
  
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [propertiesData, setPropertiesData] = useState<PropertiesData | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [propertiesLoading, setPropertiesLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl] = useState<'forSale' | 'rental' | null>(null)

  // Fetch summary once on mount
  useEffect(() => {
    const fetchSummary = async () => {
      setSummaryLoading(true)
      try {
        const response = await fetch(
          `/api/${organizationSlug}/knowledge-bases/${knowledgeBase.id}/properties?page=1&pageSize=1`
        )
        
        if (!response.ok) {
          throw new Error('Failed to fetch summary')
        }
        
        const result = await response.json()
        setSummary({
          rentalCount: result.summary.rentalCount,
          saleCount: result.summary.saleCount,
          rentalMinPrice: result.summary.rentalMinPrice,
          rentalMaxPrice: result.summary.rentalMaxPrice,
          saleMinPrice: result.summary.saleMinPrice,
          saleMaxPrice: result.summary.saleMaxPrice,
          lastSynced: result.summary.lastSynced,
          totalCount: result.pagination.totalCount,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load summary')
      } finally {
        setSummaryLoading(false)
      }
    }

    fetchSummary()
  }, [knowledgeBase.id, organizationSlug])

  // Fetch properties when page changes
  useEffect(() => {
    const fetchProperties = async () => {
      setPropertiesLoading(true)
      setError(null)
      try {
        const response = await fetch(
          `/api/${organizationSlug}/knowledge-bases/${knowledgeBase.id}/properties?page=${currentPage}&pageSize=${pageSize}`
        )
        
        if (!response.ok) {
          throw new Error('Failed to fetch properties')
        }
        
        const result = await response.json()
        setPropertiesData({
          properties: result.properties,
          pagination: result.pagination,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load properties')
      } finally {
        setPropertiesLoading(false)
      }
    }

    fetchProperties()
  }, [knowledgeBase.id, organizationSlug, currentPage, pageSize])

  // Update URL when page changes (for browser history)
  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (page === 1) {
      params.delete('page')
    } else {
      params.set('page', page.toString())
    }
    const queryString = params.toString()
    router.push(`${pathname}${queryString ? `?${queryString}` : ''}`, { scroll: false })
  }

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

  // Handle copying URLs
  const handleCopyUrl = async (url: string, type: 'forSale' | 'rental') => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedUrl(type)
      toast.success(`${type === 'forSale' ? 'For Sale' : 'Rental'} URL copied to clipboard`)
      setTimeout(() => setCopiedUrl(null), 2000)
    } catch (error) {
      toast.error(`Failed to copy ${type === 'forSale' ? 'For Sale' : 'Rental'} URL`)
      console.error(error)
    }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end gap-2">
          <PromptSheet 
            knowledgeBaseId={knowledgeBase.id}
            knowledgeBaseName={knowledgeBase.name}
          />
          <LocationDataSheet 
            knowledgeBaseId={knowledgeBase.id}
            knowledgeBaseName={knowledgeBase.name}
            organizationSlug={organizationSlug}
          />
          <SyncButton 
            knowledgeBaseId={knowledgeBase.id} 
            organizationSlug={organizationSlug}
          />
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalCount = summary?.totalCount || propertiesData?.pagination.totalCount || 0
  const rentalCount = summary?.rentalCount || 0
  const saleCount = summary?.saleCount || 0
  const rentalMinPrice = summary?.rentalMinPrice || null
  const rentalMaxPrice = summary?.rentalMaxPrice || null
  const saleMinPrice = summary?.saleMinPrice || null
  const saleMaxPrice = summary?.saleMaxPrice || null
  const lastSynced = summary?.lastSynced || null
  const paginatedProperties = propertiesData?.properties || []

  return (
    <div className="space-y-6">
      {/* Sync Button */}
      <div className="flex justify-end gap-2">
        <PromptSheet 
          knowledgeBaseId={knowledgeBase.id}
          knowledgeBaseName={knowledgeBase.name}
        />
        <LocationDataSheet 
          knowledgeBaseId={knowledgeBase.id}
          knowledgeBaseName={knowledgeBase.name}
          organizationSlug={organizationSlug}
        />
        <SyncButton 
          knowledgeBaseId={knowledgeBase.id} 
          organizationSlug={organizationSlug}
        />
      </div>

      {/* Properties Summary Card */}
      {summaryLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>Properties Summary</CardTitle>
            <CardDescription>Overview of synced properties</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          </CardContent>
        </Card>
      ) : summary && totalCount > 0 && (
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
              {(rentalMinPrice !== null || saleMinPrice !== null) && (
                <div>
                  <p className="text-sm font-medium">Price Range</p>
                  <p className="text-sm text-muted-foreground">
                    {(() => {
                      const parts: string[] = []
                      if (rentalMinPrice !== null && rentalMaxPrice !== null) {
                        if (rentalMinPrice === rentalMaxPrice) {
                          parts.push(formatPrice(rentalMinPrice, 'rent'))
                        } else {
                          parts.push(`${formatPrice(rentalMinPrice, 'rent')} - ${formatPrice(rentalMaxPrice, 'rent')}`)
                        }
                      }
                      if (saleMinPrice !== null && saleMaxPrice !== null) {
                        if (saleMinPrice === saleMaxPrice) {
                          parts.push(formatPrice(saleMinPrice, 'sale'))
                        } else {
                          parts.push(`${formatPrice(saleMinPrice, 'sale')} - ${formatPrice(saleMaxPrice, 'sale')}`)
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
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-muted-foreground break-all flex-1">
                        {forSaleUrl}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleCopyUrl(forSaleUrl, 'forSale')}
                        className="shrink-0"
                      >
                        {copiedUrl === 'forSale' ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                {rentalUrl && (
                  <div>
                    <p className="text-sm font-medium">Rental URL</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-muted-foreground break-all flex-1">
                        {rentalUrl}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleCopyUrl(rentalUrl, 'rental')}
                        className="shrink-0"
                      >
                        {copiedUrl === 'rental' ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
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
        onPageChange={handlePageChange}
        loading={propertiesLoading}
      />
    </div>
  )
}

