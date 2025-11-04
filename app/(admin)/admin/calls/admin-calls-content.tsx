'use client'

import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { IconPhoneCall } from '@tabler/icons-react'
import { AdminCallsTable } from './admin-calls-table'
import { CallsFilters } from './calls-filters'
import type { Call } from '@/lib/calls-helpers'

interface Organization {
  id: string
  name: string
  slug: string
}

interface CallsData {
  calls: Call[]
  totalCount: number
  totalPages: number
}

export function AdminCallsContent() {
  const searchParams = useSearchParams()
  const page = parseInt(searchParams.get('page') || '1', 10)
  const organizationId = searchParams.get('org') || undefined

  // Fetch organizations
  const { data: organizations = [], isLoading: orgsLoading } = useQuery<Organization[]>({
    queryKey: ['organizations', 'admin'],
    queryFn: async () => {
      const response = await fetch('/api/admin/organizations')
      if (!response.ok) {
        throw new Error('Failed to fetch organizations')
      }
      return response.json()
    },
  })

  // Fetch calls with auto-refresh
  const {
    data: callsData,
    isLoading: callsLoading,
    error: callsError,
    refetch: refetchCalls,
    isFetching: isFetchingCalls,
  } = useQuery<CallsData>({
    queryKey: ['calls', 'admin', page, organizationId],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      if (organizationId) {
        params.set('org', organizationId)
      }
      const response = await fetch(`/api/admin/calls?${params.toString()}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch calls')
      }
      return response.json()
    },
    refetchInterval: 30000,
    enabled: !orgsLoading,
  })

  const isLoading = orgsLoading || callsLoading
  const calls = callsData?.calls || []
  const totalCount = callsData?.totalCount || 0
  const totalPages = callsData?.totalPages || 0

  if (orgsLoading || callsLoading) {
    return (
      <div className="px-4 lg:px-6">
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-[280px]" />
              <Skeleton className="h-9 w-24" />
            </div>
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="font-semibold">Organization</TableHead>
                  <TableHead className="font-semibold">Assistant & Time</TableHead>
                  <TableHead className="font-semibold">Caller</TableHead>
                  <TableHead className="font-semibold">Number Called</TableHead>
                  <TableHead className="font-semibold">Duration</TableHead>
                  <TableHead className="font-semibold">Routing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="w-12">
                      <Skeleton className="size-8 rounded-md" />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Skeleton className="size-4 rounded" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Skeleton className="size-4 rounded" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    )
  }

  if (callsError) {
    return (
      <div className="px-4 lg:px-6">
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">
                {callsError instanceof Error ? callsError.message : 'Failed to load calls'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (totalCount === 0) {
    return (
      <div className="px-4 lg:px-6">
        <div className="space-y-6">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconPhoneCall />
              </EmptyMedia>
              <EmptyTitle>No Calls Yet</EmptyTitle>
              <EmptyDescription>
                Call history will appear here once organizations start receiving calls.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 lg:px-6">
      <div className="space-y-6">
        <CallsFilters
          organizations={organizations}
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          onRefresh={() => refetchCalls()}
          isRefreshing={isFetchingCalls}
        />

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12"></TableHead>
                <TableHead className="font-semibold">Organization</TableHead>
                <TableHead className="font-semibold">Assistant & Time</TableHead>
                <TableHead className="font-semibold">Caller</TableHead>
                <TableHead className="font-semibold">Number Called</TableHead>
                <TableHead className="font-semibold">Duration</TableHead>
                <TableHead className="font-semibold">Routing</TableHead>
              </TableRow>
            </TableHeader>
            <AdminCallsTable calls={calls} organizations={organizations} />
          </Table>
        </div>
      </div>
    </div>
  )
}

