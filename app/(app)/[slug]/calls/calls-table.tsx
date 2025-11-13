'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TableBody, TableCell, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { IconPhone, IconPhoneCall, IconAlertCircle } from "@tabler/icons-react"
import { formatDuration, getCallDuration, getCallerNumber, getCalledNumber, getAssistantName, getRoutingJourney, isWebCall, type Call } from "@/lib/calls-helpers"
import { CallDetailsSidebar } from "./call-details-sidebar"

interface CallsTableProps {
  calls: Call[]
  slug: string
}

export function CallsTable({ calls, slug }: CallsTableProps) {
  const [selectedCall, setSelectedCall] = useState<Call | null>(null)

  // Fetch annotation counts for all calls
  const callIds = calls.map(c => c.id)
  const { data: annotationCounts } = useQuery<Record<string, number>>({
    queryKey: ['annotation-counts', slug, callIds],
    queryFn: async () => {
      const counts: Record<string, number> = {}
      await Promise.all(
        callIds.map(async (callId) => {
          try {
            const response = await fetch(`/api/${slug}/calls/${callId}/annotations`)
            if (response.ok) {
              const data = await response.json()
              counts[callId] = data.annotations?.length || 0
            } else {
              counts[callId] = 0
            }
          } catch {
            counts[callId] = 0
          }
        })
      )
      return counts
    },
    enabled: callIds.length > 0,
  })

  return (
    <>
      <TooltipProvider>
        <TableBody>
          {calls.map((call) => {
            const duration = getCallDuration(call.data)
            const callerNumber = getCallerNumber(call)
            const calledNumber = getCalledNumber(call)
            const assistantName = getAssistantName(call.data)
            const callDate = new Date(call.created_at)
            const routingJourney = getRoutingJourney(call)
            const isWeb = isWebCall(call)
            const annotationCount = annotationCounts?.[call.id] || 0

            return (
              <TableRow 
                key={call.id} 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setSelectedCall(call)}
              >
              <TableCell className="w-12">
                <div className="flex items-center justify-center">
                  <div className="bg-muted flex size-8 items-center justify-center rounded-md">
                    <IconPhoneCall className="text-muted-foreground size-4" />
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <div className="font-medium">{assistantName}</div>
                  <div className="text-muted-foreground text-xs">
                    {callDate.toLocaleDateString()} at {callDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <IconPhone className="text-muted-foreground size-4" />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm">{isWeb ? 'Web/Test Call' : callerNumber}</span>
                    {isWeb && callerNumber !== 'Unknown' && (
                      <span className="text-xs text-muted-foreground">{callerNumber}</span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <IconPhone className="text-muted-foreground size-4" />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm">{isWeb ? 'Web/Test Call' : calledNumber}</span>
                    {isWeb && calledNumber !== 'Unknown' && (
                      <span className="text-xs text-muted-foreground">{calledNumber}</span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="font-normal">
                  {formatDuration(duration)}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={routingJourney.variant} className="font-normal" title={routingJourney.description}>
                  {routingJourney.label}
                </Badge>
              </TableCell>
              <TableCell className="w-12">
                {annotationCount > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-center">
                        <IconAlertCircle className="size-5 text-muted-foreground" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{annotationCount} {annotationCount === 1 ? 'annotation' : 'annotations'}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
      </TooltipProvider>

      {selectedCall && (
        <CallDetailsSidebar 
          call={selectedCall} 
          open={!!selectedCall}
          onClose={() => setSelectedCall(null)}
        />
      )}
    </>
  )
}

