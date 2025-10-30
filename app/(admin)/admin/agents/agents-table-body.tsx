'use client'

import { useState } from 'react'
import { TableBody, TableCell, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { IconRobot } from "@tabler/icons-react"
import type { AgentWithDetails } from "@/lib/vapi/agents"
import { getOrg } from '@/lib/auth'
import { redirect } from 'next/navigation'

interface AgentsTableBodyProps {
  agents: AgentWithDetails[]
  organizations: Array<{ id: string; slug: string; name: string }>
}

export function AgentsTableBody({ agents, organizations }: AgentsTableBodyProps) {
  const [assignedOrgs, setAssignedOrgs] = useState<Record<string, string | null>>(
    agents.reduce((acc, agent) => {
      acc[agent.vapi_assistant_id] = agent.organization?.id || null
      return acc
    }, {} as Record<string, string | null>)
  )

  const handleOrganizationChange = async (vapiAssistantId: string, organizationId: string | null) => {
    const previousValue = assignedOrgs[vapiAssistantId]
    
    // Optimistically update UI
    setAssignedOrgs(prev => ({
      ...prev,
      [vapiAssistantId]: organizationId
    }))

    try {
      const response = await fetch('/api/admin/agents/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vapi_assistant_id: vapiAssistantId,
          organization_id: organizationId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to assign agent')
      }

      const orgName = organizationId 
        ? organizations.find(o => o.id === organizationId)?.name 
        : null

      toast.success(
        organizationId 
          ? `Agent assigned to ${orgName}` 
          : 'Agent unassigned'
      )
    } catch (error) {
      console.error('Error assigning agent:', error)
      // Revert on error
      setAssignedOrgs(prev => ({
        ...prev,
        [vapiAssistantId]: previousValue
      }))
      toast.error('Failed to assign agent')
    }
  }

  return (
    <TableBody>
      {agents.map((agent) => {
        const assignedOrgId = assignedOrgs[agent.vapi_assistant_id]
        const assignedOrg = assignedOrgId 
          ? organizations.find(o => o.id === assignedOrgId)
          : null

        return (
          <TableRow key={agent.vapi_assistant_id}>
            <TableCell className="w-12">
              <div className="flex items-center justify-center">
                <div className="bg-muted flex size-8 items-center justify-center rounded-md">
                  <IconRobot className="text-muted-foreground size-4" />
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                <div className="font-medium">{agent.vapiAssistant.name}</div>
                <div className="text-muted-foreground text-xs">
                  {agent.vapiAssistant.id}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                {agent.vapiAssistant.model?.provider && (
                  <Badge variant="outline" className="text-muted-foreground w-fit px-1.5">
                    {agent.vapiAssistant.model.provider}
                  </Badge>
                )}
                {agent.vapiAssistant.model?.model && (
                  <span className="text-muted-foreground text-xs">
                    {agent.vapiAssistant.model.model}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Select
                value={assignedOrgId || "unassigned"}
                onValueChange={(value) => 
                  handleOrganizationChange(
                    agent.vapi_assistant_id, 
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
            </TableCell>
            <TableCell>
              {assignedOrg ? (
                <Badge variant="secondary" className="font-normal">
                  {assignedOrg.slug}
                </Badge>
              ) : (
                <span className="text-muted-foreground text-sm">—</span>
              )}
            </TableCell>
          </TableRow>
        )
      })}
    </TableBody>
  )
}

