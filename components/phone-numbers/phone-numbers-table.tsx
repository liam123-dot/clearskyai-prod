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
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { IconPhone, IconClock, IconChevronRight } from "@tabler/icons-react"
import type { PhoneNumberWithDetails } from "@/lib/phone-numbers"
import { TimeBasedRoutingDrawer } from "./time-based-routing-drawer"

interface Agent {
  id: string;
  vapi_assistant_id: string;
  organization_id?: string | null;
  vapiAssistant: {
    name?: string;
  };
}

interface PhoneNumbersTableProps {
  phoneNumbers: PhoneNumberWithDetails[]
  agents?: Agent[]
  organizations?: Array<{ id: string; slug: string; name: string }>
  isAdmin: boolean
  organizationSlug?: string
}

export function PhoneNumbersTable({ 
  phoneNumbers, 
  agents = [], 
  organizations = [], 
  isAdmin,
  organizationSlug
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

  const [smsEnabled, setSmsEnabled] = useState<Record<string, boolean>>(
    phoneNumbers.reduce((acc, phone) => {
      acc[phone.id] = phone.sms_enabled ?? true
      return acc
    }, {} as Record<string, boolean>)
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
    const previousAgentValue = assignedAgents[phoneNumberId]
    const previousOrgValue = assignedOrgs[phoneNumberId]
    
    // Get agent's organization if assigning
    const agent = agentId ? agents.find(a => a.id === agentId) : null
    const agentOrganizationId = agent?.organization_id || null
    
    // Optimistically update UI for both agent and organization
    setAssignedAgents(prev => ({
      ...prev,
      [phoneNumberId]: agentId
    }))
    
    // If agent belongs to an organization, also update organization assignment
    if (agentId && agentOrganizationId) {
      setAssignedOrgs(prev => ({
        ...prev,
        [phoneNumberId]: agentOrganizationId
      }))
    } else if (!agentId) {
      // If unassigning agent, don't change organization (keep it as is)
      // Organization assignment is independent
    }

    try {
      // Use different endpoint based on admin status
      const endpoint = isAdmin 
        ? '/api/admin/phone-numbers/assign'
        : `/api/${organizationSlug}/phone-numbers/assign`
      
      if (!isAdmin && !organizationSlug) {
        throw new Error('Organization slug is required for non-admin users')
      }

      const response = await fetch(endpoint, {
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
        [phoneNumberId]: previousAgentValue
      }))
      setAssignedOrgs(prev => ({
        ...prev,
        [phoneNumberId]: previousOrgValue
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

  const handleSmsEnabledChange = async (phoneNumberId: string, enabled: boolean) => {
    const previousValue = smsEnabled[phoneNumberId]
    
    // Optimistically update UI
    setSmsEnabled(prev => ({
      ...prev,
      [phoneNumberId]: enabled
    }))

    try {
      const response = await fetch('/api/admin/phone-numbers/sms-enabled', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number_id: phoneNumberId,
          sms_enabled: enabled,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update SMS enabled status')
      }

      toast.success(
        enabled 
          ? 'SMS enabled for phone number' 
          : 'SMS disabled for phone number'
      )
    } catch (error) {
      console.error('Error updating SMS enabled:', error)
      // Revert on error
      setSmsEnabled(prev => ({
        ...prev,
        [phoneNumberId]: previousValue
      }))
      toast.error('Failed to update SMS enabled status')
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
          <TableHead>Phone Number</TableHead>
          <TableHead>Agent</TableHead>
          {isAdmin && <TableHead>Organization</TableHead>}
          <TableHead className="text-center">SMS</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {phoneNumbers.length === 0 ? (
          <TableRow>
            <TableCell colSpan={isAdmin ? 4 : 3} className="text-center text-muted-foreground h-24">
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
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="bg-muted flex size-9 items-center justify-center rounded-lg shrink-0">
                      <IconPhone className="text-muted-foreground size-4" />
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatPhoneNumber(phoneNumber.phone_number)}</span>
                        {isAdmin && (
                          <Badge variant="outline" className="capitalize text-xs shrink-0">
                            {phoneNumber.provider}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {phoneNumber.schedules_count && phoneNumber.schedules_count > 0 ? (
                          <Badge variant="secondary" className="gap-1 text-xs h-5">
                            <IconClock className="size-3" />
                            {phoneNumber.schedules_count}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-xs h-5 text-muted-foreground border-dashed">
                            <IconClock className="size-3" />
                            None
                          </Badge>
                        )}
                        {isAdmin && !phoneNumber.owned_by_admin && (
                          <Badge variant="outline" className="text-xs h-5">
                            Org-owned
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={assignedAgentId || "unassigned"}
                    onValueChange={(value) => 
                      handleAgentChange(
                        phoneNumber.id, 
                        value === "unassigned" ? null : value
                      )
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Assign agent" />
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
                </TableCell>
                {isAdmin && (
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
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Assign org" />
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
                )}
                <TableCell onClick={(e) => e.stopPropagation()} className="text-center">
                  {isAdmin ? (
                    <Switch
                      checked={smsEnabled[phoneNumber.id] ?? true}
                      onCheckedChange={(checked) => 
                        handleSmsEnabledChange(phoneNumber.id, checked)
                      }
                    />
                  ) : (
                    <Badge variant={smsEnabled[phoneNumber.id] ?? true ? "default" : "secondary"} className="text-xs">
                      {smsEnabled[phoneNumber.id] ?? true ? "On" : "Off"}
                    </Badge>
                  )}
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

