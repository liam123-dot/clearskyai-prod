'use client'

import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { IconPhone, IconClock, IconChevronRight } from "@tabler/icons-react"
import type { PhoneNumberWithDetails } from "@/lib/phone-numbers"
import { TimeBasedRoutingDrawer } from "./time-based-routing-drawer"

interface Agent {
  id: string;
  vapi_assistant_id: string;
  vapiAssistant: {
    name?: string;
  };
}

interface PhoneNumbersTableProps {
  phoneNumbers: PhoneNumberWithDetails[]
  agents?: Agent[]
  organizations?: Array<{ id: string; slug: string; name: string }>
  isAdmin: boolean
}

export function PhoneNumbersTable({ 
  phoneNumbers, 
  agents = [], 
  organizations = [], 
  isAdmin 
}: PhoneNumbersTableProps) {
  const [assignedAgents, setAssignedAgents] = useState<Record<string, string | null>>(
    phoneNumbers.reduce((acc, phone) => {
      acc[phone.id] = phone.agent_id || null
      return acc
    }, {} as Record<string, string | null>)
  )

  const [assignedOrgs, setAssignedOrgs] = useState<Record<string, string | null>>(
    phoneNumbers.reduce((acc, phone) => {
      acc[phone.id] = phone.organization_id || null
      return acc
    }, {} as Record<string, string | null>)
  )

  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleRowClick = (phoneNumberId: string) => {
    setSelectedPhoneNumberId(phoneNumberId)
    setDrawerOpen(true)
  }

  const selectedPhoneNumber = selectedPhoneNumberId
    ? phoneNumbers.find(p => p.id === selectedPhoneNumberId)
    : null

  const handleAgentChange = async (phoneNumberId: string, agentId: string | null) => {
    const previousValue = assignedAgents[phoneNumberId]
    
    // Optimistically update UI
    setAssignedAgents(prev => ({
      ...prev,
      [phoneNumberId]: agentId
    }))

    try {
      const response = await fetch('/api/admin/phone-numbers/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number_id: phoneNumberId,
          agent_id: agentId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to assign phone number to agent')
      }

      const agent = agentId ? agents.find(a => a.id === agentId) : null
      toast.success(
        agentId 
          ? `Phone number assigned to ${agent?.vapiAssistant.name || agent?.vapi_assistant_id || 'agent'}` 
          : 'Phone number unassigned from agent'
      )
    } catch (error) {
      console.error('Error assigning phone number to agent:', error)
      // Revert on error
      setAssignedAgents(prev => ({
        ...prev,
        [phoneNumberId]: previousValue
      }))
      toast.error('Failed to assign phone number to agent')
    }
  }

  const handleOrganizationChange = async (phoneNumberId: string, organizationId: string | null) => {
    const previousValue = assignedOrgs[phoneNumberId]
    
    // Optimistically update UI
    setAssignedOrgs(prev => ({
      ...prev,
      [phoneNumberId]: organizationId
    }))

    try {
      const response = await fetch('/api/admin/phone-numbers/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number_id: phoneNumberId,
          organization_id: organizationId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to assign phone number to organization')
      }

      const org = organizationId ? organizations.find(o => o.id === organizationId) : null
      toast.success(
        organizationId 
          ? `Phone number assigned to ${org?.name || 'organization'}` 
          : 'Phone number unassigned from organization'
      )
    } catch (error) {
      console.error('Error assigning phone number to organization:', error)
      // Revert on error
      setAssignedOrgs(prev => ({
        ...prev,
        [phoneNumberId]: previousValue
      }))
      toast.error('Failed to assign phone number to organization')
    }
  }

  const formatPhoneNumber = (phone: string) => {
    // Simple formatting for US numbers
    if (phone.startsWith('+1') && phone.length === 12) {
      const cleaned = phone.substring(2)
      return `+1 (${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`
    }
    return phone
  }

  return (
    <>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12"></TableHead>
          <TableHead>Phone Number</TableHead>
          <TableHead>Provider</TableHead>
          <TableHead>Agent</TableHead>
          {isAdmin && <TableHead>Organization</TableHead>}
          {isAdmin && <TableHead>Ownership</TableHead>}
          <TableHead className="w-12"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {phoneNumbers.length === 0 ? (
          <TableRow>
            <TableCell colSpan={isAdmin ? 7 : 5} className="text-center text-muted-foreground h-24">
              No phone numbers found
            </TableCell>
          </TableRow>
        ) : (
          phoneNumbers.map((phoneNumber) => {
            const assignedAgentId = assignedAgents[phoneNumber.id]
            const assignedAgent = assignedAgentId 
              ? agents.find(a => a.id === assignedAgentId)
              : null
            
            const assignedOrgId = assignedOrgs[phoneNumber.id]
            const assignedOrg = assignedOrgId 
              ? organizations.find(o => o.id === assignedOrgId)
              : null

            return (
              <TableRow
                key={phoneNumber.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleRowClick(phoneNumber.id)}
              >
                <TableCell className="w-12">
                  <div className="flex items-center justify-center">
                    <div className="bg-muted flex size-8 items-center justify-center rounded-md">
                      <IconPhone className="text-muted-foreground size-4" />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatPhoneNumber(phoneNumber.phone_number)}</span>
                      {phoneNumber.schedules_count && phoneNumber.schedules_count > 0 ? (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <IconClock className="size-3" />
                          {phoneNumber.schedules_count} schedule{phoneNumber.schedules_count !== 1 ? 's' : ''}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-xs text-muted-foreground border-dashed">
                          <IconClock className="size-3" />
                          No schedule
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Click to configure time-based routing
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {phoneNumber.provider}
                  </Badge>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {isAdmin ? (
                    <Select
                      value={assignedAgentId || "unassigned"}
                      onValueChange={(value) => 
                        handleAgentChange(
                          phoneNumber.id, 
                          value === "unassigned" ? null : value
                        )
                      }
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Assign to agent" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">
                          <span className="text-muted-foreground">Unassigned</span>
                        </SelectItem>
                        {agents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.vapiAssistant.name || agent.vapi_assistant_id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    assignedAgent ? (
                      <Badge variant="secondary" className="font-normal">
                        {assignedAgent.vapiAssistant.name || assignedAgent.vapi_assistant_id}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">Unassigned</span>
                    )
                  )}
                </TableCell>
                {isAdmin && (
                  <>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {phoneNumber.owned_by_admin ? (
                        <Select
                          value={assignedOrgId || "unassigned"}
                          onValueChange={(value) => 
                            handleOrganizationChange(
                              phoneNumber.id, 
                              value === "unassigned" ? null : value
                            )
                          }
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Assign to organization" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">
                              <span className="text-muted-foreground">Unassigned</span>
                            </SelectItem>
                            {organizations.map((org) => (
                              <SelectItem key={org.id} value={org.id}>
                                {org.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        assignedOrg ? (
                          <Badge variant="secondary" className="font-normal">
                            {assignedOrg.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )
                      )}
                    </TableCell>
                    <TableCell>
                      {phoneNumber.owned_by_admin ? (
                        <Badge variant="default">Admin</Badge>
                      ) : (
                        <Badge variant="outline">Organization</Badge>
                      )}
                    </TableCell>
                  </>
                )}
                <TableCell className="w-12">
                  <div className="flex items-center justify-center">
                    <IconChevronRight className="text-muted-foreground size-4" />
                  </div>
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>

    {selectedPhoneNumber && (
      <TimeBasedRoutingDrawer
        phoneNumberId={selectedPhoneNumber.id}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        timeBasedRoutingEnabled={selectedPhoneNumber.time_based_routing_enabled}
      />
    )}
  </>
  )
}

