
import { getAgentById } from "@/lib/vapi/agents"
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
    if (agent?.vapiAssistant?.name) {
      return {
        title: agent.vapiAssistant.name,
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

  // Extract firstMessage
  const firstMessage = (agent.vapiAssistant.firstMessage as string) || ''

  // Extract prompt from system message
  const prompt = agent.vapiAssistant.model?.messages?.find(
    (msg: any) => msg.role === 'system'
  )?.content || ''

  // Extract messagePlan
  const messagePlan = (agent.vapiAssistant as any).messagePlan as {
    idleMessages?: string[]
    idleTimeoutSeconds?: number
  } | undefined

  const initialIdleMessages = messagePlan?.idleMessages || []
  const initialIdleTimeoutSeconds = messagePlan?.idleTimeoutSeconds ?? 7.5

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
