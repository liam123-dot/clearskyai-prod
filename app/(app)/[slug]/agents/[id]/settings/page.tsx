import { getAgentById } from "@/lib/vapi/agents"
import { notFound } from "next/navigation"
import { AgentSettingsForm } from "@/components/agents/agent-settings-form"
import { getAuthSession } from "@/lib/auth"

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

  // Extract voiceId from voice settings
  const voiceId = (agent.vapiAssistant.voice as any)?.voiceId || ''

  // Extract transcriber settings
  const transcriber = agent.vapiAssistant.transcriber as any
  const initialEndpointing = transcriber?.endpointing ?? 150
  const initialEotThreshold = transcriber?.eotThreshold ?? 0.73
  const initialEotTimeoutMs = transcriber?.eotTimeoutMs ?? 1900
  const initialKeyterms = (transcriber?.keyterm as string[]) || []

  // Extract speaking plan settings
  const startSpeakingPlan = agent.vapiAssistant.startSpeakingPlan as any
  const initialStartSpeakingPlanWaitSeconds = startSpeakingPlan?.waitSeconds ?? 0.1
  
  // Extract transcriptionEndpointingPlan settings
  const transcriptionEndpointingPlan = startSpeakingPlan?.transcriptionEndpointingPlan as any
  const initialTranscriptionOnPunctuationSeconds = transcriptionEndpointingPlan?.onPunctuationSeconds ?? 0.8
  const initialTranscriptionOnNoPunctuationSeconds = transcriptionEndpointingPlan?.onNoPunctuationSeconds ?? 0
  const initialTranscriptionOnNumberSeconds = transcriptionEndpointingPlan?.onNumberSeconds ?? 2

  const stopSpeakingPlan = agent.vapiAssistant.stopSpeakingPlan as any
  const initialStopSpeakingPlanVoiceSeconds = stopSpeakingPlan?.voiceSeconds ?? 0.1
  const initialStopSpeakingPlanNumWords = stopSpeakingPlan?.numWords ?? 0
  const initialStopSpeakingPlanBackoffSeconds = stopSpeakingPlan?.backoffSeconds ?? 0

  // Extract serverMessages
  const serverMessages = (agent.vapiAssistant.serverMessages as string[]) || []

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

