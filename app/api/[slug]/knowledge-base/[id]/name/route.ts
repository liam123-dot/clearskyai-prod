import { NextRequest, NextResponse } from 'next/server'
import { getKnowledgeBase } from '@/lib/knowledge-bases'
import { getAuthSession } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params
    await getAuthSession(slug) // Verify authentication
    
    const kb = await getKnowledgeBase(id)
    
    if (!kb) {
      return NextResponse.json({ name: null }, { status: 404 })
    }
    
    return NextResponse.json({ name: kb.name })
  } catch (error) {
    console.error('Error fetching knowledge base name:', error)
    return NextResponse.json({ name: null }, { status: 500 })
  }
}

