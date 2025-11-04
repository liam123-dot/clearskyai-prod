import { getAgentById } from "@/lib/vapi/agents"
import { notFound } from "next/navigation"
import { AgentSuccessEvalForm } from "@/components/agents/agent-success-eval-form"

interface SuccessEvalPageProps {
  params: Promise<{ slug: string; id: string }>
}

export default async function AgentSuccessEvalPage({ params }: SuccessEvalPageProps) {
  const { slug, id } = await params
  
  const agent = await getAgentById(id)

  if (!agent) {
    notFound()
  }

  // Extract analysisPlan settings - prioritize simple format over plan format
  const analysisPlan = agent.vapiAssistant.analysisPlan as any
  
  // Default values
  const DEFAULT_SUCCESS_EVALUATION_PROMPT = "You are an expert call evaluator. You will be given a transcript of a call and the system prompt of the AI participant. Determine if the call was successful based on the objectives inferred from the system prompt."
  const DEFAULT_SUMMARY_PROMPT = "You are an expert note-taker. You will be given a transcript of a call. Summarize the call in 2-3 sentences, if applicable."
  
  let initialSuccessEvaluationPrompt = ''
  let initialSummaryPrompt = ''
  
  initialSuccessEvaluationPrompt = analysisPlan.successEvaluationPrompt
  initialSummaryPrompt = analysisPlan.summaryPrompt
  
  
  // Use defaults if nothing was loaded
  if (!initialSuccessEvaluationPrompt) {
    initialSuccessEvaluationPrompt = DEFAULT_SUCCESS_EVALUATION_PROMPT
  }
  if (!initialSummaryPrompt) {
    initialSummaryPrompt = DEFAULT_SUMMARY_PROMPT
  }

  return (
    <div className="space-y-6">
      <AgentSuccessEvalForm
        agentId={id}
        slug={slug}
        initialSuccessEvaluationPrompt={initialSuccessEvaluationPrompt}
        initialSummaryPrompt={initialSummaryPrompt}
      />
    </div>
  )
}

