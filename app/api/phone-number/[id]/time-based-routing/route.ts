import { NextRequest, NextResponse } from 'next/server';
import { updateTimeBasedRoutingEnabled } from '@/lib/phone-numbers';
import { getPhoneNumberById } from '@/lib/phone-numbers';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: phoneNumberId } = await params;
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled must be a boolean' },
        { status: 400 }
      );
    }

    // Verify phone number exists
    const phoneNumber = await getPhoneNumberById(phoneNumberId);
    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number not found' },
        { status: 404 }
      );
    }

    // Update time-based routing enabled
    await updateTimeBasedRoutingEnabled(phoneNumberId, enabled);

    return NextResponse.json({ success: true, enabled });
  } catch (error) {
    console.error('Error updating time-based routing:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update time-based routing' },
      { status: 500 }
    );
  }
}

