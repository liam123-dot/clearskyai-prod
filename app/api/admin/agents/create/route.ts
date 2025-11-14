import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/(admin)/lib/admin-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { createAgent } from '@/lib/vapi/agents'
import { tasks } from '@trigger.dev/sdk'

async function setupDemoAgent(
  agentId: string,
  organizationId: string,
  platform: 'rightmove' | 'zoopla',
  estateAgentName: string,
  forSaleUrl: string,
  rentalUrl: string
): Promise<void> {
  await tasks.trigger('create-demo-agent', {
    agentId,
    organizationId,
    platform,
    estateAgentName,
    forSaleUrl,
    rentalUrl,
  })
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const { 
      name, 
      organization_id, 
      agent_type,
      demo_type,
      platform,
      estate_agent_name,
      for_sale_url,
      rental_url,
    } = await request.json()

    if (!name || !organization_id) {
      return NextResponse.json(
        { error: 'Name and organization_id are required' },
        { status: 400 }
      )
    }

    // Create agent and assign to organization
    let createResult
    try {
      createResult = await createAgent(name, organization_id)
    } catch (createError) {
      return NextResponse.json(
        { error: createError instanceof Error ? createError.message : 'Failed to create agent' },
        { status: 500 }
      )
    }

    // Setup demo agent if applicable
    if (agent_type === 'demo' && demo_type) {
      try {
        await setupDemoAgent(
          createResult.agent.id,
          organization_id,
          platform || 'rightmove',
          estate_agent_name,
          for_sale_url,
          rental_url
        )
      } catch (demoError) {
        console.error('Error setting up demo agent:', demoError)
        // Don't fail the request if demo setup fails - agent is still created
      }
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
        agent_id: createResult.agent.id,
        organization_slug: null,
      }, { status: 201 })
    }

    return NextResponse.json({
      success: true,
      agent_id: createResult.agent.id,
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

