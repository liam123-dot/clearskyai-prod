import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/(admin)/lib/admin-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { vapiClient } from '@/lib/vapi/VapiClients'
import { assignAgentToOrganization } from '@/lib/vapi/agents'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const { name, organization_id } = await request.json()

    if (!name || !organization_id) {
      return NextResponse.json(
        { error: 'Name and organization_id are required' },
        { status: 400 }
      )
    }

    // Create VAPI assistant with default settings
    const vapiAssistant = await vapiClient.assistants.create({
      name: name.trim(),
      model: {
        provider: 'openai',
        model: 'gpt-4.1-mini',
        temperature: 0.7,
      },
      voice: {
        voiceId: '2KeyfL6P3j1maB1yEare',
        provider: '11labs',
        model: 'eleven_flash_v2_5',
      },
      transcriber: {
        model: 'flux-general-en',
        provider: 'deepgram',
        language: 'en',
        endpointing: 150,
        eotThreshold: 0.73,
        eotTimeoutMs: 1900,
      } as any,
      startSpeakingPlan: {
        waitSeconds: 0.1,
        smartEndpointingEnabled: false,
        transcriptionEndpointingPlan: {
          onPunctuationSeconds: 0.8,
          onNoPunctuationSeconds: 0,
          onNumberSeconds: 2,
        },
      },
      stopSpeakingPlan: {
        voiceSeconds: 0.1,
        numWords: 0,
        backoffSeconds: 0,
      },
      server: {
        url: process.env.NEXT_PUBLIC_APP_URL + '/api/vapi/webhook',
      },
      serverMessages: ['chat.created', 'end-of-call-report'],
    })

    if (!vapiAssistant.id) {
      return NextResponse.json(
        { error: 'Failed to create VAPI assistant' },
        { status: 500 }
      )
    }

    // Assign agent to organization using shared function
    let assignmentResult
    try {
      assignmentResult = await assignAgentToOrganization(vapiAssistant.id, organization_id)
    } catch (assignmentError) {
      // If assignment fails, try to clean up the VAPI assistant
      try {
        await vapiClient.assistants.delete(vapiAssistant.id)
      } catch (cleanupError) {
        console.error('Failed to cleanup VAPI assistant:', cleanupError)
      }

      return NextResponse.json(
        { error: assignmentError instanceof Error ? assignmentError.message : 'Failed to assign agent' },
        { status: 500 }
      )
    }

    if (!assignmentResult.success || !assignmentResult.assigned || !assignmentResult.agent) {
      // If assignment failed, try to clean up the VAPI assistant
      try {
        await vapiClient.assistants.delete(vapiAssistant.id)
      } catch (cleanupError) {
        console.error('Failed to cleanup VAPI assistant:', cleanupError)
      }

      return NextResponse.json(
        { error: 'Failed to assign agent to organization' },
        { status: 500 }
      )
    }

    // Fetch organization slug for redirect
    const supabase = await createServiceClient()
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .select('slug')
      .eq('id', organization_id)
      .single()

    if (orgError || !org) {
      // Organization not found, but agent is created - return success with agent ID
      return NextResponse.json({
        success: true,
        agent_id: assignmentResult.agent.id,
        organization_slug: null,
      }, { status: 201 })
    }

    return NextResponse.json({
      success: true,
      agent_id: assignmentResult.agent.id,
      organization_slug: org.slug,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating agent:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

