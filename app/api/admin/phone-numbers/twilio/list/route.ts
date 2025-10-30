import { NextRequest, NextResponse } from 'next/server';
import { listTwilioPhoneNumbers } from '@/lib/twilio/phone-numbers';
import { requireAdmin } from '@/app/(admin)/lib/admin-auth';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    
    const body = await request.json();
    const { account_sid, auth_token } = body;
    
    if (!account_sid || !auth_token) {
      return NextResponse.json(
        { error: 'account_sid and auth_token are required' },
        { status: 400 }
      );
    }
    
    const phoneNumbers = await listTwilioPhoneNumbers(account_sid, auth_token);
    
    return NextResponse.json(phoneNumbers);
  } catch (error) {
    console.error('Error listing Twilio numbers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list Twilio numbers' },
      { status: 500 }
    );
  }
}

