'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TableBody, TableCell, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { IconRobot, IconTrash, IconLoader2 } from "@tabler/icons-react"
import type { AgentWithDetails } from "@/lib/vapi/agents"

interface AgentsTableBodyProps {
  agents: AgentWithDetails[]
  organizations: Array<{ id: string; slug: string; name: string }>
}

export function AgentsTableBody({ agents, organizations }: AgentsTableBodyProps) {
  const router = useRouter()
  const [assignedOrgs, setAssignedOrgs] = useState<Record<string, string | null>>(
    agents.reduce((acc, agent) => {
      acc[agent.vapi_assistant_id] = agent.organization?.id || null
      return acc
    }, {} as Record<string, string | null>)
  )
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

  const handleDelete = async () => {
    if (!agentToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/admin/agents/${agentToDelete}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete agent')
      }

      toast.success('Agent deleted successfully')
      router.refresh()
      setAgentToDelete(null)
    } catch (error) {
      console.error('Error deleting agent:', error)
      toast.error('Failed to delete agent')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <TableBody>
      {agents.map((agent) => {
        const assignedOrgId = assignedOrgs[agent.vapi_assistant_id]
        const assignedOrg = assignedOrgId 
          ? organizations.find(o => o.id === assignedOrgId)
          : null
        
        // Only make clickable if agent has a database ID and is assigned to an organization
        const canNavigate = !!agent.id && !!assignedOrg?.slug

        return (
          <TableRow 
            key={agent.vapi_assistant_id}
            className={canNavigate ? "cursor-pointer hover:bg-muted/50" : ""}
            onClick={canNavigate ? () => router.push(`/${assignedOrg.slug}/agents/${agent.id}`) : undefined}
          >
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
            <TableCell onClick={(e) => e.stopPropagation()}>
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
            <TableCell onClick={(e) => e.stopPropagation()}>
              {agent.id && (
                <AlertDialog 
                  open={agentToDelete === agent.id} 
                  onOpenChange={(open) => !open && setAgentToDelete(null)}
                >
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        setAgentToDelete(agent.id!)
                      }}
                      disabled={isDeleting}
                    >
                      {isDeleting && agentToDelete === agent.id ? (
                        <IconLoader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <IconTrash className="h-4 w-4" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the agent &quot;{agent.vapiAssistant.name}&quot;. This will remove all tool and knowledge base assignments, but call history will be preserved. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground"
                        disabled={isDeleting}
                      >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </TableCell>
          </TableRow>
        )
      })}
    </TableBody>
  )
}

