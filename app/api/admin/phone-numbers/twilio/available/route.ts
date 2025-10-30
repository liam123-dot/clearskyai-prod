import { NextRequest, NextResponse } from 'next/server';
import { searchAvailableNumbers } from '@/lib/twilio/phone-numbers';
import { requireAdmin } from '@/app/(admin)/lib/admin-auth';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    
    const body = await request.json();
    const { account_sid, auth_token, country_code, area_code, contains, limit } = body;
    
    if (!account_sid || !auth_token) {
      return NextResponse.json(
        { error: 'account_sid and auth_token are required' },
        { status: 400 }
      );
    }
    
    const phoneNumbers = await searchAvailableNumbers(account_sid, auth_token, {
      countryCode: country_code,
      areaCode: area_code,
      contains,
      limit,
    });
    
    return NextResponse.json(phoneNumbers);
  } catch (error) {
    console.error('Error searching available numbers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search available numbers' },
      { status: 500 }
    );
  }
}

