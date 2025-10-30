import { signOut } from '@workos-inc/authkit-nextjs'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    await signOut()
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Sign out error:', error)
    return NextResponse.json({ success: false, error: 'Failed to sign out' }, { status: 500 })
  }
}

