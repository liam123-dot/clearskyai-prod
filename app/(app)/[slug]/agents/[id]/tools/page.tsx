import { getAuthSession } from "@/lib/auth"
import { getAgentById } from "@/lib/vapi/agents"
import { getOrCreateAgentTools, getToolsByOrganization } from "@/lib/tools"
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

  let attachedTools: Awaited<ReturnType<typeof getOrCreateAgentTools>> = []
  let availableTools: Awaited<ReturnType<typeof getToolsByOrganization>> = []
  let error: string | null = null

  try {
    // Get or create tools for the agent's toolIds
    attachedTools = await getOrCreateAgentTools(id, toolIds)

    // Get all organization tools
    const allOrgTools = await getToolsByOrganization(organizationId)

    // Filter out tools that are already attached
    const attachedToolExternalIds = new Set(attachedTools.map(t => t.external_tool_id))
    availableTools = allOrgTools.filter(
      tool => !attachedToolExternalIds.has(tool.external_tool_id)
    )
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