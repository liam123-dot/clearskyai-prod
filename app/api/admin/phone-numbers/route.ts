import { NextResponse } from 'next/server';
import { getPhoneNumbers } from '@/lib/phone-numbers';
import { requireAdmin } from '@/app/(admin)/lib/admin-auth';

export async function GET() {
  try {
    await requireAdmin();
    
    const phoneNumbers = await getPhoneNumbers();
    
    return NextResponse.json(phoneNumbers);
  } catch (error) {
    console.error('Error fetching phone numbers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch phone numbers' },
      { status: 500 }
    );
  }
}

