import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { updateAgent } from '@/lib/agents'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id: agentId } = await params
    const { organizationId } = await getAuthSession(slug)

    const body = await request.json()
    const { 
      firstMessage, 
      prompt, 
      voiceId, 
      transcriber, 
      serverMessages, 
      startSpeakingPlan, 
      stopSpeakingPlan,
      analysisPlan,
      messagePlan
    } = body

    // Validate that at least one field is being updated
    if (
      firstMessage === undefined && 
      prompt === undefined && 
      voiceId === undefined &&
      transcriber === undefined &&
      serverMessages === undefined &&
      startSpeakingPlan === undefined &&
      stopSpeakingPlan === undefined &&
      analysisPlan === undefined &&
      messagePlan === undefined
    ) {
      return NextResponse.json(
        { error: 'At least one field must be provided for update' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()

    // Get the agent to verify ownership
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('organization_id')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Verify agent belongs to organization
    if (agent.organization_id !== organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Update the agent using the unified function (works for both Vapi and ElevenLabs)
    await updateAgent(agentId, {
      firstMessage,
      prompt,
      voiceId,
      transcriber,
      serverMessages,
      startSpeakingPlan,
      stopSpeakingPlan,
      analysisPlan,
      messagePlan,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating agent:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update agent' },
      { status: 500 }
    )
  }
}

