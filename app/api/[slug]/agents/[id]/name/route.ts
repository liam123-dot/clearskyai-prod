import { NextRequest, NextResponse } from 'next/server'
import { getAgentById } from '@/lib/vapi/agents'
import { getAuthSession } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params
    await getAuthSession(slug) // Verify authentication
    
    const agent = await getAgentById(id)
    
    if (!agent) {
      return NextResponse.json({ name: null }, { status: 404 })
    }
    
    return NextResponse.json({ name: agent.vapiAssistant.name || 'Unnamed Agent' })
  } catch (error) {
    console.error('Error fetching agent name:', error)
    return NextResponse.json({ name: null }, { status: 500 })
  }
}

