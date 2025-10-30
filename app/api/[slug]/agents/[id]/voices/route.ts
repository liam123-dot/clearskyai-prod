import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id: agentId } = await params
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

    // Get filter parameters from query string
    const { searchParams } = new URL(request.url)
    const language = searchParams.get('language') || 'en'
    const accent = searchParams.get('accent') || 'british'

    // Fetch voices from ElevenLabs API
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': process.env.ELEVEN_API_KEY,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ElevenLabs API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch voices from ElevenLabs' },
        { status: response.status }
      )
    }

    const data = await response.json()
    let voices = data.voices || []

    // Extract language and accent info from labels
    // ElevenLabs voices have labels object with language/accent info
    voices = voices.map((voice: any) => {
      const labels = voice.labels || {}
      // Try different possible label keys
      const languageLabel = labels.language || labels.accent || labels.use_case || ''
      const accentLabel = labels.accent || ''
      
      // Normalize language/accent values
      const normalizedLanguage = languageLabel.toLowerCase().trim()
      const normalizedAccent = accentLabel.toLowerCase().trim()
      
      return {
        voice_id: voice.voice_id,
        name: voice.name,
        preview_url: voice.preview_url,
        category: voice.category,
        language: normalizedLanguage,
        accent: normalizedAccent,
        labels: labels,
      }
    })

    // Filter voices by language and accent
    const filteredVoices = voices.filter((voice: any) => {
      const langFilter = language.toLowerCase()
      const accentFilterValue = accent.toLowerCase()
      
      // If "all" is selected, don't filter
      if (langFilter === 'all' && accentFilterValue === 'all') {
        return true
      }
      
      // Check language match
      const matchesLanguage = langFilter === 'all' || 
        !langFilter ||
        voice.language?.includes(langFilter) ||
        voice.name?.toLowerCase().includes(langFilter)
      
      // Check accent match (could be in accent field or language field for British English, etc.)
      const matchesAccent = accentFilterValue === 'all' ||
        !accentFilterValue ||
        voice.accent?.includes(accentFilterValue) ||
        voice.language?.includes(accentFilterValue) ||
        voice.name?.toLowerCase().includes(accentFilterValue)
      
      return matchesLanguage && matchesAccent
    })

    // Extract unique languages and accents for filter options
    const languages = Array.from(new Set(
      voices
        .map((v: any) => v.language)
        .filter((l: string) => l)
        .map((l: string) => l.charAt(0).toUpperCase() + l.slice(1))
    )).sort()

    const accents = Array.from(new Set(
      voices
        .map((v: any) => v.accent)
        .filter((a: string) => a)
        .map((a: string) => a.charAt(0).toUpperCase() + a.slice(1))
    )).sort()

    // Return filtered voices with available filter options
    return NextResponse.json({
      voices: filteredVoices,
      filters: {
        languages,
        accents,
      },
    })
  } catch (error) {
    console.error('Error fetching voices:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch voices' },
      { status: 500 }
    )
  }
}

