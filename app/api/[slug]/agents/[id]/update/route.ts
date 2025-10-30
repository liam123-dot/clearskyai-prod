import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { vapiClient } from '@/lib/vapi/VapiClients'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id: agentId } = await params
    const { organizationId } = await getAuthSession(slug)

    const body = await request.json()
    const { prompt, voiceId } = body

    // Validate that at least one field is being updated
    if (prompt === undefined && voiceId === undefined) {
      return NextResponse.json(
        { error: 'At least one of prompt or voiceId must be provided' },
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
        provider: 'elevenlabs',
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

