
import { getAgentById } from "@/lib/agents"
import { notFound, redirect } from "next/navigation"
import { AgentPromptsForm } from "@/components/agents/agent-prompts-form"
import type { Metadata } from "next"

interface AgentPageProps {
  params: Promise<{ slug: string; id: string }>
}

export async function generateMetadata({ params }: AgentPageProps): Promise<Metadata> {
  const { slug, id } = await params
  
  try {
    const agent = await getAgentById(id)
    if (agent?.name) {
      return {
        title: agent.name,
      }
    }
  } catch (error) {
    // Fallback to generic title if fetch fails
  }
  
  return {
    title: "Agents",
  }
}

export default async function AgentConfigurationPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  
  const agent = await getAgentById(id)

  if (!agent) {
    redirect(`/${slug}/agents`)
  }

  // Extract data from unified agent model
  const firstMessage = agent.firstMessage || ''
  const prompt = agent.systemPrompt || ''
  const initialIdleMessages = agent.idleMessages || []
  const initialIdleTimeoutSeconds = agent.idleTimeoutSeconds ?? 7.5

  return (
    <div className="space-y-6">
      <AgentPromptsForm
        agentId={id}
        slug={slug}
        initialFirstMessage={firstMessage}
        initialPrompt={prompt}
        initialIdleMessages={initialIdleMessages}
        initialIdleTimeoutSeconds={initialIdleTimeoutSeconds}
      />
    </div>
  )
}
