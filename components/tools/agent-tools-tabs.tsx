"use client"

import { useState } from "react"
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
  attachedTools,
  availableTools,
  slug,
  agentId,
}: AgentToolsTabsProps) {
  const [activeTab, setActiveTab] = useState("attached")
  const [isCopyingAll, setIsCopyingAll] = useState(false)

  const handleCopyAllPrompts = async () => {
    // Filter tools that are usable by the agent (not execute_on_call_start)
    const agentUsableTools = attachedTools.filter(
      tool => tool.execute_on_call_start !== true
    )

    if (agentUsableTools.length === 0) {
      toast.error('No agent-usable tools found')
      return
    }

    setIsCopyingAll(true)
    try {
      // Fetch prompts for all tools
      const promptPromises = agentUsableTools.map(async (tool) => {
        try {
          const response = await fetch(`/api/${slug}/tools/${tool.id}/llm-prompt`)
          if (!response.ok) {
            console.error(`Failed to fetch prompt for tool ${tool.id}`)
            return null
          }
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

      // Combine all prompts with separators
      const combinedPrompt = validPrompts.join('\n\n---\n\n')

      // Copy to clipboard
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

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList>
        <TabsTrigger value="attached">
          Attached Tools
          {attachedTools.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {attachedTools.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="available">
          Available Tools
          {availableTools.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {availableTools.length}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="attached" className="mt-6">
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {attachedTools.length} {attachedTools.length === 1 ? 'tool is' : 'tools are'} currently attached to this agent
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyAllPrompts}
                disabled={isCopyingAll || attachedTools.filter(tool => tool.execute_on_call_start !== true).length === 0}
              >
                {isCopyingAll ? (
                  <>
                    <IconLoader className="h-4 w-4 mr-2 animate-spin" />
                    Copying...
                  </>
                ) : (
                  <>
                    <IconCopy className="h-4 w-4 mr-2" />
                    Copy All Prompts
                  </>
                )}
              </Button>
            </div>
            <AgentToolsTable tools={attachedTools} slug={slug} agentId={agentId} />
          </div>
        )}
      </TabsContent>

      <TabsContent value="available" className="mt-6">
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
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {availableTools.length} {availableTools.length === 1 ? 'tool is' : 'tools are'} available to attach
            </p>
            <AvailableToolsTable tools={availableTools} slug={slug} agentId={agentId} />
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}

