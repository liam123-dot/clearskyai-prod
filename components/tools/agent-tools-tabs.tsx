"use client"

import { useState, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tool } from "@/lib/tools"
import { AgentToolsTable } from "@/components/tools/agent-tools-table"
import { AvailableToolsTable } from "@/components/tools/available-tools-table"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { IconTool, IconCopy, IconLoader } from "@tabler/icons-react"
import { toast } from "sonner"

interface AgentToolsTabsProps {
  attachedTools: Tool[]
  availableTools: Tool[]
  slug: string
  agentId: string
}

export function AgentToolsTabs({
  attachedTools: initialAttachedTools,
  availableTools: initialAvailableTools,
  slug,
  agentId,
}: AgentToolsTabsProps) {
  const [activeTab, setActiveTab] = useState("attached")
  const [isCopyingAll, setIsCopyingAll] = useState(false)
  const [attachedTools, setAttachedTools] = useState(initialAttachedTools)
  const [availableTools, setAvailableTools] = useState(initialAvailableTools)

  const handleAttach = useCallback(async (tool: Tool) => {
    try {
      const response = await fetch(`/api/${slug}/agents/${agentId}/tools/attach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId: tool.id }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to attach tool')
      }

      // Update state after successful API call (exclude query tools)
      setAvailableTools(prev => prev.filter(t => t.id !== tool.id))
      if (tool.type !== 'query') {
        setAttachedTools(prev => [...prev, tool])
      }
      toast.success('Tool attached successfully')
    } catch (error) {
      console.error('Error attaching tool:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to attach tool')
      throw error
    }
  }, [slug, agentId])

  const handleDetach = useCallback(async (tool: Tool) => {
    try {
      const response = await fetch(`/api/${slug}/agents/${agentId}/tools/detach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId: tool.id }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to detach tool')
      }

      // Update state after successful API call (exclude query tools from available)
      setAttachedTools(prev => prev.filter(t => t.id !== tool.id))
      if (tool.type !== 'query') {
        setAvailableTools(prev => [...prev, tool].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ))
      }
      toast.success('Tool detached successfully')
    } catch (error) {
      console.error('Error detaching tool:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to detach tool')
      throw error
    }
  }, [slug, agentId])

  const handleCopyAllPrompts = async () => {
    // Filter tools that are usable by the agent (not pre-call only)
    const agentUsableTools = attachedTools.filter(
      tool => tool.execute_on_call_start !== true
    )

    if (agentUsableTools.length === 0) {
      toast.error('No agent-usable tools found')
      return
    }

    setIsCopyingAll(true)
    try {
      const promptPromises = agentUsableTools.map(async (tool) => {
        try {
          const response = await fetch(`/api/${slug}/tools/${tool.id}/llm-prompt`)
          if (!response.ok) return null
          const data = await response.json()
          return data.prompt
        } catch (error) {
          console.error(`Error fetching prompt for tool ${tool.id}:`, error)
          return null
        }
      })

      const prompts = await Promise.all(promptPromises)
      const validPrompts = prompts.filter((prompt): prompt is string => prompt !== null)

      if (validPrompts.length === 0) {
        toast.error('Failed to fetch any tool prompts')
        return
      }

      const combinedPrompt = validPrompts.join('\n\n---\n\n')
      await navigator.clipboard.writeText(combinedPrompt)
      
      const toolCount = validPrompts.length
      toast.success(`Copied ${toolCount} tool ${toolCount === 1 ? 'prompt' : 'prompts'} to clipboard`)
    } catch (error) {
      console.error('Error copying all prompts:', error)
      toast.error('Failed to copy tool prompts')
    } finally {
      setIsCopyingAll(false)
    }
  }

  const agentUsableToolsCount = attachedTools.filter(
    tool => tool.execute_on_call_start !== true
  ).length

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <div className="flex items-center justify-between mb-6">
        <TabsList>
          <TabsTrigger value="attached" className="gap-2">
            Attached Tools
            {attachedTools.length > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
                {attachedTools.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="available" className="gap-2">
            Available Tools
            {availableTools.length > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
                {availableTools.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {activeTab === "attached" && attachedTools.length > 0 && agentUsableToolsCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyAllPrompts}
            disabled={isCopyingAll}
            className="gap-2"
          >
            {isCopyingAll ? (
              <>
                <IconLoader className="h-4 w-4 animate-spin" />
                Copying...
              </>
            ) : (
              <>
                <IconCopy className="h-4 w-4" />
                Copy All Prompts
              </>
            )}
          </Button>
        )}
      </div>

      <TabsContent value="attached" className="mt-0">
        {attachedTools.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconTool />
              </EmptyMedia>
              <EmptyTitle>No Tools Attached</EmptyTitle>
              <EmptyDescription>
                No tools are currently attached to this agent. Switch to the "Available Tools" tab to attach tools.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <AgentToolsTable 
            tools={attachedTools} 
            slug={slug} 
            agentId={agentId}
            onDetach={handleDetach}
          />
        )}
      </TabsContent>

      <TabsContent value="available" className="mt-0">
        {availableTools.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconTool />
              </EmptyMedia>
              <EmptyTitle>No Tools Available</EmptyTitle>
              <EmptyDescription>
                All tools have been attached to this agent, or no tools are available for this organization.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <AvailableToolsTable 
            tools={availableTools} 
            slug={slug} 
            agentId={agentId}
            onAttach={handleAttach}
          />
        )}
      </TabsContent>
    </Tabs>
  )
}

