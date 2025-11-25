import { getAgentById } from "@/lib/agents"
import { notFound } from "next/navigation"
import { AgentSettingsForm } from "@/components/agents/agent-settings-form"
import { getAuthSession } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"
import Link from "next/link"

interface SettingsPageProps {
  params: Promise<{ slug: string; id: string }>
}

export default async function AgentSettingsPage({ params }: SettingsPageProps) {
  const { slug, id } = await params
  
  const { isAdmin } = await getAuthSession(slug)
  const agent = await getAgentById(id)

  if (!agent) {
    notFound()
  }

  // For ElevenLabs agents, show a message to configure in provider dashboard
  if (agent.provider === 'elevenlabs') {
    const elevenLabsDashboardUrl = `https://elevenlabs.io/app/conversational-ai/${agent.externalAgentId}`
    
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Advanced Settings</CardTitle>
            <CardDescription>
              Configure advanced agent settings in the ElevenLabs dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              To configure voice settings, transcription options, and other advanced features for your ElevenLabs agent, 
              please use the ElevenLabs dashboard.
            </p>
            <Button asChild>
              <Link href={elevenLabsDashboardUrl} target="_blank" rel="noopener noreferrer">
                Open in ElevenLabs Dashboard
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // For Vapi agents, show the full settings form
  if (!agent.rawVapiData) {
    notFound()
  }

  // Extract voiceId from voice settings
  const voiceId = (agent.rawVapiData.voice as any)?.voiceId || ''

  // Extract transcriber settings
  const transcriber = agent.rawVapiData.transcriber as any
  const initialEndpointing = transcriber?.endpointing ?? 150
  const initialEotThreshold = transcriber?.eotThreshold ?? 0.73
  const initialEotTimeoutMs = transcriber?.eotTimeoutMs ?? 1900
  const initialKeyterms = (transcriber?.keyterm as string[]) || []

  // Extract speaking plan settings
  const startSpeakingPlan = agent.rawVapiData.startSpeakingPlan as any
  const initialStartSpeakingPlanWaitSeconds = startSpeakingPlan?.waitSeconds ?? 0.1
  
  // Extract transcriptionEndpointingPlan settings
  const transcriptionEndpointingPlan = startSpeakingPlan?.transcriptionEndpointingPlan as any
  const initialTranscriptionOnPunctuationSeconds = transcriptionEndpointingPlan?.onPunctuationSeconds ?? 0.8
  const initialTranscriptionOnNoPunctuationSeconds = transcriptionEndpointingPlan?.onNoPunctuationSeconds ?? 0
  const initialTranscriptionOnNumberSeconds = transcriptionEndpointingPlan?.onNumberSeconds ?? 2

  const stopSpeakingPlan = agent.rawVapiData.stopSpeakingPlan as any
  const initialStopSpeakingPlanVoiceSeconds = stopSpeakingPlan?.voiceSeconds ?? 0.1
  const initialStopSpeakingPlanNumWords = stopSpeakingPlan?.numWords ?? 0
  const initialStopSpeakingPlanBackoffSeconds = stopSpeakingPlan?.backoffSeconds ?? 0

  // Extract serverMessages
  const serverMessages = (agent.rawVapiData.serverMessages as string[]) || []

  return (
    <div className="space-y-6">
      <AgentSettingsForm
        agentId={id}
        slug={slug}
        isAdmin={isAdmin}
        initialVoiceId={voiceId}
        initialEndpointing={initialEndpointing}
        initialEotThreshold={initialEotThreshold}
        initialEotTimeoutMs={initialEotTimeoutMs}
        initialStartSpeakingPlanWaitSeconds={initialStartSpeakingPlanWaitSeconds}
        initialTranscriptionOnPunctuationSeconds={initialTranscriptionOnPunctuationSeconds}
        initialTranscriptionOnNoPunctuationSeconds={initialTranscriptionOnNoPunctuationSeconds}
        initialTranscriptionOnNumberSeconds={initialTranscriptionOnNumberSeconds}
        initialStopSpeakingPlanVoiceSeconds={initialStopSpeakingPlanVoiceSeconds}
        initialStopSpeakingPlanNumWords={initialStopSpeakingPlanNumWords}
        initialStopSpeakingPlanBackoffSeconds={initialStopSpeakingPlanBackoffSeconds}
        initialServerMessages={serverMessages}
        initialKeyterms={initialKeyterms}
      />
    </div>
  )
}

