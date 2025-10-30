import { NextRequest, NextResponse } from 'next/server';
import { listTwilioPhoneNumbers } from '@/lib/twilio/phone-numbers';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    
    // Verify organization exists
    const supabase = await createServiceClient();
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .select('id')
      .eq('slug', slug)
      .single();
    
    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }
    
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

