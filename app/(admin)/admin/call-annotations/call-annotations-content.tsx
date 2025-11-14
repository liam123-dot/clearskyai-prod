'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { IconMessageCircle, IconRefresh, IconX } from '@tabler/icons-react'
import { CallAnnotationsTable } from './call-annotations-table'

interface Organization {
  id: string
  name: string
  slug: string
}

interface Agent {
  id: string
  vapi_assistant_id: string
  name: string
}

interface EnrichedAnnotation {
  id: string
  call_id: string
  organization_id: string
  created_by_admin: boolean
  annotation_level: 'call' | 'transcript_item'
  transcript_item_index: number | null
  issue_category: string
  note: string
  created_at: string
  updated_at: string
  call: {
    id: string
    created_at: string
    caller_number: string | null
    called_number: string | null
    agent_id: string
    data: any
  }
  organization: {
    id: string
    name: string
    slug: string
  }
  agent: {
    id: string
    vapi_assistant_id: string
    name: string
  }
}

interface AnnotationsData {
  annotations: EnrichedAnnotation[]
}

export function CallAnnotationsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const organizationId = searchParams.get('org') || undefined
  const agentId = searchParams.get('agent') || undefined

  // Fetch organizations for filter
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

  // Fetch agents for filter (filtered by org if selected)
  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ['agents', 'admin', organizationId],
    queryFn: async () => {
      const url = organizationId 
        ? `/api/admin/agents?org=${organizationId}`
        : '/api/admin/agents'
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch agents')
      }
      const data = await response.json()
      // Extract unique agents from the response
      const agentsMap = new Map()
      data.forEach((agent: any) => {
        if (!agentsMap.has(agent.id)) {
          agentsMap.set(agent.id, {
            id: agent.id,
            vapi_assistant_id: agent.vapi_assistant_id,
            name: agent.name || agent.vapi_assistant_id,
          })
        }
      })
      return Array.from(agentsMap.values())
    },
    enabled: !orgsLoading,
  })

  // Fetch annotations with auto-refresh
  const {
    data: annotationsData,
    isLoading: annotationsLoading,
    error: annotationsError,
    refetch: refetchAnnotations,
    isFetching: isFetchingAnnotations,
  } = useQuery<AnnotationsData>({
    queryKey: ['call-annotations', 'admin', organizationId, agentId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (organizationId) params.set('org', organizationId)
      if (agentId) params.set('agent', agentId)
      
      const response = await fetch(`/api/admin/call-annotations?${params.toString()}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch annotations')
      }
      return response.json()
    },
    refetchInterval: 30000,
    enabled: !orgsLoading && !agentsLoading,
  })

  const annotations = annotationsData?.annotations || []
  const isLoading = orgsLoading || agentsLoading || annotationsLoading

  const handleOrganizationChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') {
      params.delete('org')
      params.delete('agent') // Clear agent filter when org changes
    } else {
      params.set('org', value)
      params.delete('agent') // Clear agent filter when org changes
    }
    router.push(`?${params.toString()}`)
  }

  const handleAgentChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') {
      params.delete('agent')
    } else {
      params.set('agent', value)
    }
    router.push(`?${params.toString()}`)
  }

  const handleClearFilters = () => {
    router.push('/admin/call-annotations')
  }

  const hasFilters = organizationId || agentId

  if (isLoading) {
    return (
      <div className="px-4 lg:px-6">
        <div className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Call Annotations</h2>
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-[280px]" />
              <Skeleton className="h-10 w-[280px]" />
              <Skeleton className="h-9 w-24" />
            </div>
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">Organization</TableHead>
                  <TableHead className="font-semibold">Agent</TableHead>
                  <TableHead className="font-semibold">Issue</TableHead>
                  <TableHead className="font-semibold">Level</TableHead>
                  <TableHead className="font-semibold">Call Date</TableHead>
                  <TableHead className="font-semibold">Note</TableHead>
                  <TableHead className="font-semibold">Source</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    )
  }

  if (annotationsError) {
    return (
      <div className="px-4 lg:px-6">
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Call Annotations</h2>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">
                {annotationsError instanceof Error ? annotationsError.message : 'Failed to load annotations'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (annotations.length === 0 && !hasFilters) {
    return (
      <div className="px-4 lg:px-6">
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Call Annotations</h2>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconMessageCircle />
              </EmptyMedia>
              <EmptyTitle>No Annotations Yet</EmptyTitle>
              <EmptyDescription>
                Call annotations will appear here once users start marking calls.
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Call Annotations</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchAnnotations()}
              disabled={isFetchingAnnotations}
              className="cursor-pointer"
            >
              <IconRefresh className={`size-4 mr-2 ${isFetchingAnnotations ? 'animate-spin' : ''}`} />
              {isFetchingAnnotations ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <Select value={organizationId || 'all'} onValueChange={handleOrganizationChange}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Filter by organization..." />
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

            <Select value={agentId || 'all'} onValueChange={handleAgentChange} disabled={!organizationId && agents.length === 0}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Filter by agent..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                <IconX className="size-4 mr-2" />
                Clear Filters
              </Button>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            {annotations.length} {annotations.length === 1 ? 'annotation' : 'annotations'} found
          </p>
        </div>

        {annotations.length === 0 && hasFilters ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconMessageCircle />
              </EmptyMedia>
              <EmptyTitle>No Annotations Found</EmptyTitle>
              <EmptyDescription>
                No annotations match the selected filters. Try adjusting your filters.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">Organization</TableHead>
                  <TableHead className="font-semibold">Agent</TableHead>
                  <TableHead className="font-semibold">Issue</TableHead>
                  <TableHead className="font-semibold">Level</TableHead>
                  <TableHead className="font-semibold">Call Date</TableHead>
                  <TableHead className="font-semibold">Note</TableHead>
                  <TableHead className="font-semibold">Source</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <CallAnnotationsTable annotations={annotations} />
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

