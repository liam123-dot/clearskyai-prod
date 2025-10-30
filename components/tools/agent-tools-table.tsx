"use client"

import { Tool } from "@/lib/tools"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import Image from "next/image"
import { PipedreamActionToolConfig } from "@/lib/tools/types"

interface AgentToolsTableProps {
  tools: Tool[]
  slug: string
  agentId: string
}

function getToolTypeBadgeColor(type: Tool['type']) {
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

function getToolTypeLabel(type: Tool['type'], tool?: Tool): string {
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

export function AgentToolsTable({ tools, slug, agentId }: AgentToolsTableProps) {
  const [detaching, setDetaching] = useState<Record<string, boolean>>({})

  const handleDetach = async (toolId: string) => {
    setDetaching(prev => ({ ...prev, [toolId]: true }))

    try {
      const response = await fetch(`/api/${slug}/agents/${agentId}/tools/detach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ toolId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to detach tool')
      }

      toast.success('Tool detached successfully')
      window.location.reload()
    } catch (error) {
      console.error('Error detaching tool:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to detach tool')
    } finally {
      setDetaching(prev => ({ ...prev, [toolId]: false }))
    }
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            <TableHead className="font-semibold">Name</TableHead>
            <TableHead className="font-semibold">Type</TableHead>
            <TableHead className="font-semibold">Created</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tools.map((tool) => {
            const imageSrc = getToolImageSrc(tool)
            const typeLabel = getToolTypeLabel(tool.type, tool)
            
            return (
              <TableRow key={tool.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    {imageSrc ? (
                      <Image
                        src={imageSrc}
                        alt={tool.label || tool.name}
                        width={32}
                        height={32}
                        className="flex-shrink-0 rounded object-contain"
                      />
                    ) : (
                      <div className="w-8 h-8 flex-shrink-0 bg-muted rounded flex items-center justify-center text-xs font-medium">
                        {(tool.label || tool.name).charAt(0).toUpperCase()}
                      </div>
                    )}
                    {tool.label || tool.name}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={getToolTypeBadgeColor(tool.type)}
                  >
                    {typeLabel}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDistanceToNow(new Date(tool.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDetach(tool.id)}
                    disabled={detaching[tool.id]}
                  >
                    {detaching[tool.id] ? 'Detaching...' : 'Detach'}
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

