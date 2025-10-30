
import { getAgentById } from "@/lib/vapi/agents"
import { notFound } from "next/navigation"
import { AgentSettingsForm } from "@/components/agents/agent-settings-form"
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
    notFound()
  }

  // Extract firstMessage
  const firstMessage = (agent.vapiAssistant.firstMessage as string) || ''

  // Extract prompt from system message
  const prompt = agent.vapiAssistant.model?.messages?.find(
    (msg: any) => msg.role === 'system'
  )?.content || ''

  // Extract voiceId from voice settings
  const voiceId = (agent.vapiAssistant.voice as any)?.voiceId || ''

  return (
    <div className="space-y-6">
      <AgentSettingsForm
        agentId={id}
        slug={slug}
        initialFirstMessage={firstMessage}
        initialPrompt={prompt}
        initialVoiceId={voiceId}
      />
    </div>
  )
}
