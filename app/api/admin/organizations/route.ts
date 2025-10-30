import { NextResponse } from 'next/server'
import { getOrganizations } from '@/lib/organizations'

export async function GET() {
  try {
    const organizations = await getOrganizations()
    return NextResponse.json(organizations)
  } catch (error) {
    console.error('Error fetching organizations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    )
  }
}
