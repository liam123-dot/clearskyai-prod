import { NextRequest, NextResponse } from 'next/server';
import { updateSmsEnabled, getPhoneNumberById } from '@/lib/phone-numbers';
import { requireAdmin } from '@/app/(admin)/lib/admin-auth';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    
    const body = await request.json();
    const { phone_number_id, sms_enabled } = body;
    
    if (!phone_number_id) {
      return NextResponse.json(
        { error: 'phone_number_id is required' },
        { status: 400 }
      );
    }
    
    if (typeof sms_enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'sms_enabled must be a boolean' },
        { status: 400 }
      );
    }
    
    // Verify phone number exists
    const phoneNumber = await getPhoneNumberById(phone_number_id);
    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number not found' },
        { status: 404 }
      );
    }
    
    // Update SMS enabled status
    await updateSmsEnabled(phone_number_id, sms_enabled);
    
    return NextResponse.json({ success: true, sms_enabled });
  } catch (error) {
    console.error('Error updating SMS enabled:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update SMS enabled' },
      { status: 500 }
    );
  }
}

