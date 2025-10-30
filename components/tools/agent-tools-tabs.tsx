"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
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
import { IconTool } from "@tabler/icons-react"

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
            <p className="text-sm text-muted-foreground">
              {attachedTools.length} {attachedTools.length === 1 ? 'tool is' : 'tools are'} currently attached to this agent
            </p>
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

