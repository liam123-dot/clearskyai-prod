import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { createTool, ToolType } from '@/lib/tools'

export async function POST(request: NextRequest) {
  try {
    // Check if user is admin
    const { isAdmin } = await getAuthSession()
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { organizationId, externalToolId, type, name, data } = body

    // Validate required fields
    if (!organizationId || !externalToolId || !type || !name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate tool type
    const validTypes: ToolType[] = ['query', 'sms', 'apiRequest', 'transferCall', 'externalApp']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid tool type' },
        { status: 400 }
      )
    }

    // Create the tool assignment
    const tool = await createTool(
      organizationId,
      externalToolId,
      type,
      name,
      data
    )

    return NextResponse.json({ success: true, tool })
  } catch (error) {
    console.error('Error assigning tool:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to assign tool' },
      { status: 500 }
    )
  }
}

