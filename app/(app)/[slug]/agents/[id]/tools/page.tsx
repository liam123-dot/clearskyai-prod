import { getAuthSession } from "@/lib/auth"
import { getAgentById } from "@/lib/vapi/agents"
import { getToolsByOrganization, getAgentTools } from "@/lib/tools"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { IconTool } from "@tabler/icons-react"
import { AgentToolsTabs } from "@/components/tools/agent-tools-tabs"

interface AgentToolsPageProps {
  params: Promise<{ slug: string; id: string }>
}

export default async function AgentToolsPage({ params }: AgentToolsPageProps) {
  const { slug, id } = await params
  const { organizationId } = await getAuthSession(slug)

  const agent = await getAgentById(id)

  if (!agent) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">Agent not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const toolIds = agent.vapiAssistant.model?.toolIds || []

  let attachedTools: Awaited<ReturnType<typeof getAgentTools>> = []
  let availableTools: Awaited<ReturnType<typeof getToolsByOrganization>> = []
  let error: string | null = null

  try {
    // Get tools from both VAPI toolIds and agent_tools table
    const allAttachedTools = await getAgentTools(id)
    
    // Filter out query type tools from attached tools
    attachedTools = allAttachedTools.filter(tool => tool.type !== 'query')

    // Get all organization tools
    const allOrgTools = await getToolsByOrganization(organizationId)

    // Get sets of attached tool IDs for filtering
    const attachedToolDbIds = new Set(allAttachedTools.map(t => t.id))
    const attachedToolExternalIds = new Set(
      allAttachedTools
        .map(t => t.external_tool_id)
        .filter((id): id is string => id !== null)
    )
    
    // Filter available tools:
    // 1. Exclude query type tools
    // 2. Tools with attach_to_agent = true that aren't already attached via VAPI
    // 3. Tools with attach_to_agent = false AND execute_on_call_start = true that aren't in agent_tools
    availableTools = allOrgTools.filter(tool => {
      // Skip query type tools
      if (tool.type === 'query') {
        return false
      }

      // Skip if already attached
      if (attachedToolDbIds.has(tool.id)) {
        return false
      }

      // For attach_to_agent = true tools: must have external_tool_id and not be in VAPI toolIds
      if (tool.attach_to_agent !== false) {
        return tool.external_tool_id !== null && !attachedToolExternalIds.has(tool.external_tool_id)
      }

      // For attach_to_agent = false tools: must have execute_on_call_start = true
      if (tool.attach_to_agent === false) {
        return tool.execute_on_call_start === true
      }

      return false
    })
  } catch (e) {
    console.error('Error fetching tools:', e)
    error = e instanceof Error ? e.message : 'Failed to load tools'
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (attachedTools.length === 0 && availableTools.length === 0) {
    return (
      <div className="space-y-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconTool />
            </EmptyMedia>
            <EmptyTitle>No Tools Available</EmptyTitle>
            <EmptyDescription>
              No tools are available for this organization yet.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AgentToolsTabs
        attachedTools={attachedTools}
        availableTools={availableTools}
        slug={slug}
        agentId={id}
      />
    </div>
  )
}