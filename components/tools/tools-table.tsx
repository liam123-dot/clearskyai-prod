"use client"

import { Tool } from "@/lib/tools"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import Image from "next/image"
import { IconDotsVertical, IconCopy } from "@tabler/icons-react"
import { toast } from "sonner"
import { getToolTypeBadgeColor, getToolTypeLabel, getToolImageSrc } from "@/lib/tools/display"

interface ToolsTableProps {
  tools: Tool[]
  slug: string
}

export function ToolsTable({ tools, slug }: ToolsTableProps) {
  const router = useRouter()

  const handleCopyToolDescription = async (toolId: string) => {
    try {
      const response = await fetch(`/api/${slug}/tools/${toolId}/llm-prompt`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch tool description')
      }
      
      const data = await response.json()
      
      if (!data.prompt) {
        throw new Error('No prompt data received')
      }
      
      await navigator.clipboard.writeText(data.prompt)
      toast.success('Tool description copied to clipboard')
    } catch (error) {
      console.error('Error copying tool description:', error)
      toast.error('Failed to copy tool description')
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
            <TableHead className="font-semibold w-12"></TableHead>
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
                  <Badge
                    variant="secondary"
                    className={`${getToolTypeBadgeColor(tool.type)} hover:opacity-80`}
                  >
                    {typeLabel}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDistanceToNow(new Date(tool.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell>
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
                          size="icon"
                        >
                          <IconDotsVertical className="size-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => handleCopyToolDescription(tool.id)}
                        >
                          <IconCopy className="size-4 mr-2" />
                          Copy tool description
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

