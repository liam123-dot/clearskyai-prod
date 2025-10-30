import { NextRequest, NextResponse } from 'next/server';
import { getPhoneNumberByNumber } from '@/lib/phone-numbers';

export async function POST(request: NextRequest) {
  try {
    // Get the "To" phone number from Twilio's request
    const formData = await request.formData();
    const toNumber = formData.get('To') as string;
    
    if (!toNumber) {
      console.error('No "To" phone number in request');
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        }
      );
    }
    
    // Look up the phone number in our database
    const phoneNumber = await getPhoneNumberByNumber(toNumber);
    
    if (!phoneNumber) {
      console.error(`Phone number ${toNumber} not found in database`);
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        }
      );
    }
    
    // Log the call details
    console.log('Incoming call to:', {
      phone_number: phoneNumber.phone_number,
      agent_id: phoneNumber.agent_id,
      organization_id: phoneNumber.organization_id,
      provider: phoneNumber.provider,
    });
    
    // TODO: Forward to Vapi or handle the call
    // For now, return empty TwiML response
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      }
    );
  } catch (error) {
    console.error('Error handling incoming call:', error);
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      }
    );
  }
}

