import { NextRequest, NextResponse } from 'next/server';
import { purchasePhoneNumber } from '@/lib/twilio/phone-numbers';
import { importPhoneNumber } from '@/lib/phone-numbers';
import { requireAdmin } from '@/app/(admin)/lib/admin-auth';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    
    const body = await request.json();
    const { phone_number, account_sid, auth_token, agent_id } = body;
    
    if (!phone_number || !account_sid || !auth_token) {
      return NextResponse.json(
        { error: 'phone_number, account_sid, and auth_token are required' },
        { status: 400 }
      );
    }
    
    // Purchase the number from Twilio (webhook will be set when agent is assigned)
    // Use a temporary webhook URL for now
    const tempWebhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/call-incoming`;
    const purchasedNumber = await purchasePhoneNumber(
      account_sid,
      auth_token,
      phone_number,
      tempWebhookUrl
    );
    
    // Import into database
    const dbPhoneNumber = await importPhoneNumber({
      phone_number: purchasedNumber.phoneNumber,
      provider: 'twilio',
      credentials: {
        account_sid,
        auth_token,
        phone_number_sid: purchasedNumber.sid,
      },
      organization_id: null,
      owned_by_admin: true,
      agent_id: agent_id || null,
    });
    
    return NextResponse.json({
      success: true,
      phone_number: dbPhoneNumber,
    });
  } catch (error) {
    console.error('Error purchasing phone number:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to purchase phone number' },
      { status: 500 }
    );
  }
}

