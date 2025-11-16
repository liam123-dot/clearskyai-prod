import { getAgentById } from "@/lib/vapi/agents"
import { notFound } from "next/navigation"
import { VoiceWidget } from "@/components/vapi/voice-widget"
import { EmbedCodeSection } from "@/components/vapi/embed-code-section"
import { Card } from "@/components/ui/card"

interface WebsiteWidgetPageProps {
  params: Promise<{ slug: string; id: string }>
}

export default async function WebsiteWidgetPage({ params }: WebsiteWidgetPageProps) {
  const { slug, id } = await params
  
  const agent = await getAgentById(id)

  if (!agent) {
    notFound()
  }

  const vapiPublishableKey = process.env.NEXT_PUBLIC_VAPI_PUBLISHABLE_KEY
  const assistantId = agent.vapi_assistant_id
  const agentName = agent.vapiAssistant.name || "Voice Assistant"
  const agentDescription = "Tap to start voice chat"
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ""

  if (!vapiPublishableKey) {
    return (
      <div className="space-y-6">
        <div className="text-destructive">
          Vapi publishable key is not configured. Please set NEXT_PUBLIC_VAPI_PUBLISHABLE_KEY environment variable.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Website Widget</h2>
        <p className="text-muted-foreground">
          Embed a compact voice assistant button on your website. A horizontal button with an animated orb appears in the bottom right corner.
          Users can click it to start a voice conversation with your agent directly.
        </p>
      </div>
      
      <EmbedCodeSection agentId={id} baseUrl={baseUrl} />
      
            <VoiceWidget
              assistantId={assistantId}
              vapiPublishableKey={vapiPublishableKey}
              agentName={agentName}
              agentDescription={agentDescription}
            />
    </div>
  )
}

