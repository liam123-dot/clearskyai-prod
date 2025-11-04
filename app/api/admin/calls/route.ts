import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/(admin)/lib/admin-auth'
import { getAllCallsPaginated } from '@/lib/calls'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const organizationId = searchParams.get('org') || undefined

    const callsData = await getAllCallsPaginated(page, organizationId)

    return NextResponse.json(callsData)
  } catch (error) {
    console.error('Error fetching calls:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch calls' },
      { status: 500 }
    )
  }
}

