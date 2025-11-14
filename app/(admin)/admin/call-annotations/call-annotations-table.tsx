'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { TableBody, TableCell, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { IconExternalLink, IconTrash } from '@tabler/icons-react'
import { toast } from 'sonner'
import { CallDetailsSidebar } from '@/app/(app)/[slug]/calls/call-details-sidebar'
import type { Call } from '@/lib/calls-helpers'

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

interface CallAnnotationsTableProps {
  annotations: EnrichedAnnotation[]
}

export function CallAnnotationsTable({ annotations }: CallAnnotationsTableProps) {
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)
  const [deletingAnnotationId, setDeletingAnnotationId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // Fetch full call data when an annotation is clicked
  const { data: selectedCallData, isLoading: isLoadingCall } = useQuery<{ call: Call }>({
    queryKey: ['admin-call', selectedCallId],
    queryFn: async () => {
      if (!selectedCallId) throw new Error('No call ID')
      const response = await fetch(`/api/admin/calls/${selectedCallId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch call')
      }
      return response.json()
    },
    enabled: !!selectedCallId,
  })

  // Delete annotation mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ callId, annotationId }: { callId: string; annotationId: string }) => {
      const response = await fetch(`/api/admin/calls/${callId}/annotations/${annotationId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete annotation')
      }
      return response.json()
    },
    onSuccess: () => {
      // Invalidate all call-annotations queries to refetch the list
      queryClient.invalidateQueries({ queryKey: ['call-annotations', 'admin'] })
      toast.success('Annotation deleted successfully')
      setDeletingAnnotationId(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete annotation')
      setDeletingAnnotationId(null)
    },
  })

  const selectedCall = selectedCallData?.call || null

  const handleRowClick = (callId: string) => {
    setSelectedCallId(callId)
  }

  const handleDelete = (callId: string, annotationId: string) => {
    setDeletingAnnotationId(annotationId)
    deleteMutation.mutate({ callId, annotationId })
  }

  const truncateNote = (note: string, maxLength: number = 60) => {
    if (note.length <= maxLength) return note
    return note.substring(0, maxLength) + '...'
  }

  return (
    <>
      <TableBody>
        {annotations.map((annotation) => {
          const callDate = new Date(annotation.call.created_at)

          return (
            <TableRow
              key={annotation.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleRowClick(annotation.call_id)}
            >
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{annotation.organization.name}</span>
                    <Link
                      href={`/admin/client/${annotation.organization.slug}`}
                      className="text-xs text-muted-foreground hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="flex items-center gap-1">
                        {annotation.organization.slug}
                        <IconExternalLink className="size-3" />
                      </span>
                    </Link>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm">{annotation.agent.name}</span>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="font-normal">
                  {annotation.issue_category}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-normal capitalize">
                  {annotation.annotation_level === 'call' ? 'Call' : 'Transcript'}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span className="text-sm">{callDate.toLocaleDateString()}</span>
                  <span className="text-xs text-muted-foreground">
                    {callDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {truncateNote(annotation.note)}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant={annotation.created_by_admin ? 'default' : 'outline'} className="font-normal">
                  {annotation.created_by_admin ? 'Admin' : 'Client'}
                </Badge>
              </TableCell>
              <TableCell>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => e.stopPropagation()}
                      disabled={deletingAnnotationId === annotation.id}
                    >
                      <IconTrash className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Annotation?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the annotation.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(annotation.call_id, annotation.id)}
                        disabled={deletingAnnotationId === annotation.id}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deletingAnnotationId === annotation.id ? 'Deleting...' : 'Delete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>

      {selectedCall && (
        <CallDetailsSidebar
          call={selectedCall}
          open={!!selectedCall && !isLoadingCall}
          onClose={() => setSelectedCallId(null)}
          isAdmin={true}
        />
      )}
    </>
  )
}

