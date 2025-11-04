"use client"

import { Tool } from "@/lib/tools"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import Image from "next/image"
import { PipedreamActionToolConfig } from "@/lib/tools/types"
import { useState } from "react"
import { IconLoader2 } from "@tabler/icons-react"

interface AvailableToolsTableProps {
  tools: Tool[]
  slug: string
  agentId: string
  onAttach?: (tool: Tool) => Promise<void>
}

function getToolTypeBadgeColor(type: Tool['type']) {
  switch (type) {
    case 'query':
      return 'bg-purple-50 text-purple-700 border-purple-200'
    case 'sms':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'apiRequest':
      return 'bg-green-50 text-green-700 border-green-200'
    case 'transferCall':
      return 'bg-orange-50 text-orange-700 border-orange-200'
    case 'externalApp':
      return 'bg-slate-50 text-slate-700 border-slate-200'
    case 'pipedream_action':
      return 'bg-slate-50 text-slate-700 border-slate-200'
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200'
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

export function AvailableToolsTable({ tools, slug, agentId, onAttach }: AvailableToolsTableProps) {
  const router = useRouter()
  const [attachingId, setAttachingId] = useState<string | null>(null)

  const handleAttach = async (tool: Tool, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onAttach || attachingId) return
    
    setAttachingId(tool.id)
    try {
      await onAttach(tool)
    } finally {
      setAttachingId(null)
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
              <TableRow 
                key={tool.id}
                className="cursor-pointer"
                onClick={() => router.push(`/${slug}/tools/${tool.id}`)}
              >
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
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={`${getToolTypeBadgeColor(tool.type)} font-medium`}
                    >
                      {typeLabel}
                    </Badge>
                    {tool.execute_on_call_start && (
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-700 border-amber-200 font-medium text-[10px] px-1.5 py-0"
                      >
                        PRE-CALL
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDistanceToNow(new Date(tool.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    onClick={(e) => handleAttach(tool, e)}
                    disabled={attachingId !== null || !onAttach}
                    className="h-8"
                  >
                    {attachingId === tool.id ? (
                      <>
                        <IconLoader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        Attaching...
                      </>
                    ) : (
                      'Attach'
                    )}
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

