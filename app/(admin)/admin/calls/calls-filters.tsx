'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { IconChevronLeft, IconChevronRight, IconRefresh } from "@tabler/icons-react"

interface Organization {
  id: string
  slug: string
  name: string
}

interface CallsFiltersProps {
  organizations: Organization[]
  currentPage: number
  totalPages: number
  totalCount: number
  onRefresh: () => void
  isRefreshing: boolean
}

export function CallsFilters({ 
  organizations, 
  currentPage, 
  totalPages,
  totalCount,
  onRefresh,
  isRefreshing
}: CallsFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedOrg = searchParams.get('org') || 'all'

  const handleOrgChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') {
      params.delete('org')
    } else {
      params.set('org', value)
    }
    // Reset to page 1 when changing filters
    params.delete('page')
    router.push(`?${params.toString()}`)
  }

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (newPage === 1) {
      params.delete('page')
    } else {
      params.set('page', newPage.toString())
    }
    router.push(`?${params.toString()}`)
  }

  const startRecord = (currentPage - 1) * 50 + 1
  const endRecord = Math.min(currentPage * 50, totalCount)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedOrg} onValueChange={handleOrgChange}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select organization" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Organizations</SelectItem>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="cursor-pointer"
          >
            <IconRefresh className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          Showing {startRecord}-{endRecord} of {totalCount} {totalCount === 1 ? 'call' : 'calls'}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <IconChevronLeft className="size-4" />
            Previous
          </Button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 7) {
                pageNum = i + 1
              } else if (currentPage <= 4) {
                pageNum = i + 1
              } else if (currentPage >= totalPages - 3) {
                pageNum = totalPages - 6 + i
              } else {
                pageNum = currentPage - 3 + i
              }

              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(pageNum)}
                  className="w-10"
                >
                  {pageNum}
                </Button>
              )
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
            <IconChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

