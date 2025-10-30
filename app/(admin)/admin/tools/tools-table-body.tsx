"use client"

import { useState } from "react"
import { TableBody, TableCell, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Organization } from "@/lib/organizations"
import { Tool } from "@/lib/tools"
import Image from "next/image"
import { PipedreamActionToolConfig } from "@/lib/tools/types"

interface ToolsTableBodyProps {
  vapiTools: any[]
  dbTools: Tool[]
  toolAssignments: Map<string, Tool>
  organizations: Organization[]
  showOnlyAssigned: boolean
}

function getToolTypeBadgeColor(type: string) {
  switch (type) {
    case 'query':
      return 'bg-purple-100 text-purple-700 hover:bg-purple-100'
    case 'sms':
      return 'bg-blue-100 text-blue-700 hover:bg-blue-100'
    case 'apiRequest':
      return 'bg-green-100 text-green-700 hover:bg-green-100'
    case 'transferCall':
      return 'bg-orange-100 text-orange-700 hover:bg-orange-100'
    case 'externalApp':
      return 'bg-gray-100 text-gray-700 hover:bg-gray-100'
    case 'pipedream_action':
      return 'bg-gray-100 text-gray-700 hover:bg-gray-100'
    default:
      return 'bg-gray-100 text-gray-700 hover:bg-gray-100'
  }
}

function getToolTypeLabel(type: string, tool?: Tool): string {
  // For Pipedream actions, show app name and action name
  if (type === 'pipedream_action' && tool?.config_metadata) {
    const config = tool.config_metadata as unknown as PipedreamActionToolConfig
    if (config.pipedreamMetadata?.appName && config.pipedreamMetadata?.actionName) {
      return `${config.pipedreamMetadata.appName} - ${config.pipedreamMetadata.actionName}`
    }
  }
  
  // For other types, use standard labels
  switch (type) {
    case 'query':
      return 'Query'
    case 'sms':
      return 'SMS'
    case 'apiRequest':
      return 'API Request'
    case 'transferCall':
      return 'Transfer Call'
    case 'externalApp':
      return 'External App'
    default:
      return type
  }
}

function getToolImageSrc(tool: Tool): string | null {
  if (tool.type === 'pipedream_action' && tool.config_metadata) {
    const config = tool.config_metadata as unknown as PipedreamActionToolConfig
    return config.pipedreamMetadata?.appImgSrc || null
  }
  return null
}

export function ToolsTableBody({ vapiTools, dbTools, toolAssignments, organizations, showOnlyAssigned }: ToolsTableBodyProps) {
  const [selectedOrg, setSelectedOrg] = useState<Record<string, string>>({})
  const [assigning, setAssigning] = useState<Record<string, boolean>>({})

  const handleAssign = async (toolId: string, toolName: string, toolType: string, toolData: any) => {
    const orgId = selectedOrg[toolId]
    if (!orgId) {
      toast.error('Please select an organization')
      return
    }

    setAssigning(prev => ({ ...prev, [toolId]: true }))

    try {
      const response = await fetch('/api/admin/tools/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: orgId,
          externalToolId: toolId,
          type: toolType,
          name: toolName,
          data: toolData,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to assign tool')
      }

      toast.success('Tool assigned successfully')
      window.location.reload()
    } catch (error) {
      console.error('Error assigning tool:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to assign tool')
    } finally {
      setAssigning(prev => ({ ...prev, [toolId]: false }))
    }
  }

  // For assigned tools, show DB tools with their VAPI data
  if (showOnlyAssigned) {
    return (
      <TableBody>
        {dbTools.map((dbTool) => {
          const assignedOrg = organizations.find(o => o.id === dbTool.organization_id)
          const vapiTool = vapiTools.find(t => t.id === dbTool.external_tool_id)
          const imageSrc = getToolImageSrc(dbTool)
          const typeLabel = getToolTypeLabel(dbTool.type || '', dbTool)
          const displayName = dbTool.label || dbTool.name

          return (
            <TableRow key={dbTool.id}>
              <TableCell>
                <div className="w-2 h-2 rounded-full bg-green-500" />
              </TableCell>
              <TableCell className="font-medium">
                <div className="flex items-center gap-3">
                  {imageSrc ? (
                    <Image
                      src={imageSrc}
                      alt={displayName}
                      width={32}
                      height={32}
                      className="flex-shrink-0 rounded object-contain"
                    />
                  ) : (
                    <div className="w-8 h-8 flex-shrink-0 bg-muted rounded flex items-center justify-center text-xs font-medium">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {displayName}
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={getToolTypeBadgeColor(dbTool.type || '')}
                >
                  {typeLabel}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="text-sm">{assignedOrg?.name || 'Unknown'}</span>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">{assignedOrg?.slug || '-'}</span>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    )
  }

  // For unassigned tools, show VAPI tools that can be assigned
  return (
    <TableBody>
      {vapiTools.map((tool) => {
        const toolName = tool.function?.name || tool.name || tool.id
        return (
          <TableRow key={tool.id}>
            <TableCell>
              <div className="w-2 h-2 rounded-full bg-gray-300" />
            </TableCell>
            <TableCell className="font-medium">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex-shrink-0 bg-muted rounded flex items-center justify-center text-xs font-medium">
                  {toolName.charAt(0).toUpperCase()}
                </div>
                {toolName}
              </div>
            </TableCell>
            <TableCell>
              <Badge
                variant="secondary"
                className={getToolTypeBadgeColor(tool.type)}
              >
                {getToolTypeLabel(tool.type)}
              </Badge>
            </TableCell>
            <TableCell>
              <Select
                value={selectedOrg[tool.id] || ''}
                onValueChange={(value) => {
                  setSelectedOrg(prev => ({ ...prev, [tool.id]: value }))
                }}
                disabled={assigning[tool.id]}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Button
                size="sm"
                onClick={() => handleAssign(tool.id, toolName, tool.type, tool)}
                disabled={assigning[tool.id] || !selectedOrg[tool.id]}
              >
                {assigning[tool.id] ? 'Assigning...' : 'Assign'}
              </Button>
            </TableCell>
          </TableRow>
        )
      })}
    </TableBody>
  )
}

