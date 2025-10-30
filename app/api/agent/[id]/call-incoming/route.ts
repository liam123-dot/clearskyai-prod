import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get the incoming FormData from Twilio
    const twimlRequest = await request.formData();
    console.log('TwiML request:', twimlRequest);

    const { id: agentId } = await params;
    
    // Extract all fields from the incoming FormData
    const formDataToSend = new URLSearchParams();
    for (const [key, value] of twimlRequest.entries()) {
      formDataToSend.append(key, value.toString());
    }
    
    // Forward to Vapi's inbound call endpoint with proper content-type
    const vapiResponse = await fetch('https://api.vapi.ai/twilio/inbound_call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // Include any necessary auth headers if required by Vapi
        // 'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      },
      body: formDataToSend,
    });

    if (!vapiResponse.ok) {
      console.error(`Vapi responded with status ${vapiResponse.status}`);
      console.error(`Vapi response body: ${await vapiResponse.text()}`);
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Unable to connect to voice assistant. Please try again later.</Say></Response>',
        {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        }
      );
    }

    // Get the TwiML response from Vapi and return it to Twilio
    const vapiTwiml = await vapiResponse.text();
    console.log('Vapi TwiML response:', vapiTwiml);

    return new NextResponse(vapiTwiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('Error handling incoming call:', error);
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred. Please try again later.</Say></Response>',
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      }
    );
  }
}

