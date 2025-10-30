'use client'

import { useState } from 'react'
import { TableBody, TableCell, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { IconPhone, IconPhoneCall } from "@tabler/icons-react"
import { formatDuration, getCallDuration, getCallerNumber, getCalledNumber, getAssistantName, getRoutingJourney, type Call } from "@/lib/calls-helpers"
import { CallDetailsSidebar } from "@/app/(app)/[slug]/calls/call-details-sidebar"

interface Organization {
  id: string
  name: string
  slug: string
}

interface AdminCallsTableProps {
  calls: Call[]
  organizations: Organization[]
}

export function AdminCallsTable({ calls, organizations }: AdminCallsTableProps) {
  const [selectedCall, setSelectedCall] = useState<Call | null>(null)

  // Create a map for quick organization lookups
  const orgMap = new Map(organizations.map(org => [org.id, org]))

  return (
    <>
      <TableBody>
        {calls.map((call) => {
          const duration = getCallDuration(call.data)
          const callerNumber = getCallerNumber(call)
          const calledNumber = getCalledNumber(call)
          const assistantName = getAssistantName(call.data)
          const callDate = new Date(call.created_at)
          const routingJourney = getRoutingJourney(call)
          const organization = orgMap.get(call.organization_id)

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
                  <div className="font-medium">{organization?.name || 'Unknown'}</div>
                  <div className="text-muted-foreground text-xs">
                    {organization?.slug || 'unknown'}
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
                  <span className="text-sm">{callerNumber}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <IconPhone className="text-muted-foreground size-4" />
                  <span className="text-sm">{calledNumber}</span>
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
            </TableRow>
          )
        })}
      </TableBody>

      {selectedCall && (
        <CallDetailsSidebar 
          call={selectedCall} 
          open={!!selectedCall}
          onClose={() => setSelectedCall(null)}
          isAdmin={true}
        />
      )}
    </>
  )
}

