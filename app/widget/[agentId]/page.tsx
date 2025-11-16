import { getAgentById } from "@/lib/vapi/agents"
import { notFound } from "next/navigation"
import { VoiceWidget } from "@/components/vapi/voice-widget"

interface WidgetPageProps {
  params: Promise<{ agentId: string }>
}

export const metadata = {
  robots: 'noindex, nofollow',
}

export default async function WidgetPage({ params }: WidgetPageProps) {
  const { agentId } = await params
  
  const agent = await getAgentById(agentId)

  if (!agent) {
    notFound()
  }

  const vapiPublishableKey = process.env.NEXT_PUBLIC_VAPI_PUBLISHABLE_KEY
  const assistantId = agent.vapi_assistant_id
  const agentName = agent.vapiAssistant.name || "Voice Assistant"
  const agentDescription = "Tap to start voice chat"

  if (!vapiPublishableKey) {
    return (
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body style={{ margin: 0, padding: 0, background: 'transparent', overflow: 'hidden' }}>
          <div style={{ color: 'red', padding: '20px' }}>
            Widget configuration error
          </div>
        </body>
      </html>
    )
  }

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style dangerouslySetInnerHTML={{
          __html: `
            * { box-sizing: border-box; }
            html, body { 
              margin: 0; 
              padding: 0; 
              background: transparent; 
              overflow: hidden;
              width: 100%;
              height: 100%;
            }
          `
        }} />
      </head>
      <body>
        <VoiceWidget
          assistantId={assistantId}
          vapiPublishableKey={vapiPublishableKey}
          agentName={agentName}
          agentDescription={agentDescription}
        />
      </body>
    </html>
  )
}

