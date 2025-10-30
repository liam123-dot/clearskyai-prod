import { NextRequest, NextResponse } from 'next/server'
import { getTool } from '@/lib/tools'
import { getAuthSession } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params
    await getAuthSession(slug) // Verify authentication
    
    const tool = await getTool(id)
    
    if (!tool) {
      return NextResponse.json({ name: null }, { status: 404 })
    }
    
    return NextResponse.json({ name: tool.label || tool.name })
  } catch (error) {
    console.error('Error fetching tool name:', error)
    return NextResponse.json({ name: null }, { status: 500 })
  }
}

