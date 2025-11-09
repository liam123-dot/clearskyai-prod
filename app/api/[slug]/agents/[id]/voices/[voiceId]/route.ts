import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string; voiceId: string }> }
) {
  try {
    const { slug, id: agentId, voiceId } = await params
    const { organizationId } = await getAuthSession(slug)

    const supabase = await createServiceClient()

    // Verify agent belongs to organization
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

    if (agent.organization_id !== organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Check if ElevenLabs API key is configured
    if (!process.env.ELEVEN_API_KEY) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      )
    }

    // Validate voiceId parameter
    if (!voiceId || voiceId.trim() === '') {
      return NextResponse.json(
        { error: 'Voice ID is required' },
        { status: 400 }
      )
    }

    // Fetch single voice from ElevenLabs API
    const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      headers: {
        'xi-api-key': process.env.ELEVEN_API_KEY,
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Voice not found' },
          { status: 404 }
        )
      }
      
      const errorText = await response.text()
      console.error('ElevenLabs API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch voice from ElevenLabs' },
        { status: response.status }
      )
    }

    const voice = await response.json()

    console.log('Voice:', voice)

    // Return voice details
    return NextResponse.json({
      voice_id: voice.voice_id,
      name: voice.name,
      preview_url: voice.preview_url,
      category: voice.category,
      labels: voice.labels || {},
    })
  } catch (error) {
    console.error('Error fetching voice:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch voice' },
      { status: 500 }
    )
  }
}

