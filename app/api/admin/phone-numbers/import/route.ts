import { NextRequest, NextResponse } from 'next/server';
import { importPhoneNumber } from '@/lib/phone-numbers';
import { requireAdmin } from '@/app/(admin)/lib/admin-auth';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    
    const body = await request.json();
    const { phone_numbers } = body;
    
    if (!phone_numbers || !Array.isArray(phone_numbers)) {
      return NextResponse.json(
        { error: 'phone_numbers array is required' },
        { status: 400 }
      );
    }
    
    const results = [];
    
    for (const number of phone_numbers) {
      try {
        const { phone_number, account_sid, auth_token, phone_number_sid, agent_id } = number;
        
        if (!phone_number || !account_sid || !auth_token || !phone_number_sid) {
          results.push({
            phone_number,
            success: false,
            error: 'Missing required fields',
          });
          continue;
        }
        
        // Import into database (webhook will be set when agent is assigned)
        await importPhoneNumber({
          phone_number,
          provider: 'twilio',
          credentials: {
            account_sid,
            auth_token,
            phone_number_sid,
          },
          organization_id: null,
          owned_by_admin: true,
          agent_id: agent_id || null,
        });
        
        results.push({
          phone_number,
          success: true,
        });
      } catch (error) {
        results.push({
          phone_number: number.phone_number,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error importing phone numbers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import phone numbers' },
      { status: 500 }
    );
  }
}

