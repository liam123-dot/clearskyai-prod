import { getAgentById } from "@/lib/agents"
import { notFound } from "next/navigation"
import { EmbedCodeSection } from "@/components/vapi/embed-code-section"
import { WidgetPreview } from "@/components/agents/widget-preview"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

interface WebsiteWidgetPageProps {
  params: Promise<{ slug: string; id: string }>
}

export default async function WebsiteWidgetPage({ params }: WebsiteWidgetPageProps) {
  const { slug, id } = await params
  
  const agent = await getAgentById(id)

  if (!agent) {
    notFound()
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ""

  // Only ElevenLabs agents support widget embed
  if (agent.provider !== 'elevenlabs') {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Website Widget</h2>
          <p className="text-muted-foreground">
            Embed a compact voice assistant button on your website.
          </p>
        </div>
        
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Website widget is only available for ElevenLabs agents. This agent uses {agent.provider}.
          </AlertDescription>
        </Alert>
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
      
      <WidgetPreview agentId={id} baseUrl={baseUrl} />
    </div>
  )
}
