import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { vapiClient } from '@/lib/vapi/VapiClients'
import { createServiceClient } from '@/lib/supabase/server'
import { ensureRequiredServerMessages } from '@/lib/vapi/agents'

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

    // Get the agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('vapi_assistant_id, organization_id')
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

    // Fetch current assistant from VAPI
    const assistant = await vapiClient.assistants.get(agent.vapi_assistant_id)

    // Prepare update object
    const updateData: any = {}

    // Update firstMessage if provided
    if (firstMessage !== undefined) {
      updateData.firstMessage = firstMessage
    }

    // Update prompt if provided
    if (prompt !== undefined) {
      updateData.model = {
        ...assistant.model,
        messages: [
          {
            role: 'system',
            content: prompt,
          },
          ...(assistant.model?.messages?.filter((m: any) => m.role !== 'system') || []),
        ],
      }
    }

    // Update voiceId if provided
    if (voiceId !== undefined) {
      updateData.voice = {
        ...(assistant.voice as any),
        voiceId: voiceId,
        provider: '11labs',
        model: 'eleven_flash_v2_5',
      }
    }

    // Update transcriber if provided
    if (transcriber !== undefined) {
      updateData.transcriber = {
        ...(assistant.transcriber as any),
        ...transcriber,
      }
    }

    // Update serverMessages if provided
    // Always ensure chat.created and end-of-call-report are included
    if (serverMessages !== undefined) {
      updateData.serverMessages = ensureRequiredServerMessages(serverMessages)
    } else {
      // If serverMessages not provided, check if required ones are missing
      const existingServerMessages = (assistant.serverMessages as string[]) || []
      const requiredMessages = ['chat.created', 'end-of-call-report']
      const hasAllRequired = requiredMessages.every(msg => existingServerMessages.includes(msg))
      
      // Only update if required messages are missing
      if (!hasAllRequired) {
        updateData.serverMessages = ensureRequiredServerMessages(existingServerMessages)
      }
    }

    // Update startSpeakingPlan if provided
    if (startSpeakingPlan !== undefined) {
      updateData.startSpeakingPlan = {
        ...(assistant.startSpeakingPlan as any),
        ...startSpeakingPlan,
      }
    }

    // Update stopSpeakingPlan if provided
    if (stopSpeakingPlan !== undefined) {
      updateData.stopSpeakingPlan = {
        ...(assistant.stopSpeakingPlan as any),
        ...stopSpeakingPlan,
      }
    }

    // Update analysisPlan if provided
    if (analysisPlan !== undefined) {
      updateData.analysisPlan = {
        ...(assistant.analysisPlan as any),
        ...analysisPlan,
      }
    }

    // Update messagePlan if provided
    if (messagePlan !== undefined) {
      updateData.messagePlan = {
        ...((assistant as any).messagePlan as any),
        ...messagePlan,
      }
    }

    // Update the assistant (Vapi SDK merges partial updates)
    await vapiClient.assistants.update(agent.vapi_assistant_id, updateData)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating agent:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update agent' },
      { status: 500 }
    )
  }
}

