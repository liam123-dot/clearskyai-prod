import { NextRequest, NextResponse } from 'next/server';
import { getPhoneNumberById } from '@/lib/phone-numbers';
import { findMatchingSchedule, generateTransferTwiML } from '@/lib/call-routing';
import { createServiceClient } from '@/lib/supabase/server';
import { executeOnCallStartTools } from '@/lib/tools/on-call-start';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: phoneNumberId } = await params;
    
    // Get the incoming FormData from Twilio
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;

    if (!callSid) {
      console.error('No CallSid in Twilio request');
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Invalid request.</Say></Response>',
        {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        }
      );
    }

    // Get phone number details
    const phoneNumber = await getPhoneNumberById(phoneNumberId);
    
    if (!phoneNumber) {
      console.error(`Phone number ${phoneNumberId} not found`);
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Phone number not found.</Say></Response>',
        {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        }
      );
    }

    if (!phoneNumber.agent_id) {
      console.error(`Phone number ${phoneNumberId} has no assigned agent`);
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>No agent assigned.</Say></Response>',
        {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        }
      );
    }

    // Create initial call record
    const supabase = await createServiceClient();
    let routingStatus: 'transferred_to_team' | 'direct_to_agent' = 'direct_to_agent';
    let matchingSchedule = null;

    // Check if time-based routing is enabled and find matching schedule
    if (phoneNumber.time_based_routing_enabled) {
      matchingSchedule = await findMatchingSchedule(phoneNumberId);
      
      if (matchingSchedule) {
        routingStatus = 'transferred_to_team';
      }
    }

    // Create call record
    const eventSequence: Array<{
      type: string;
      timestamp: string;
      details: Record<string, unknown>;
    }> = [
      {
        type: 'incoming_call',
        timestamp: new Date().toISOString(),
        details: {
          from,
          to,
        },
      },
    ];

    const { error: insertError, data: callRecord } = await supabase
      .from('calls')
      .insert({
        organization_id: phoneNumber.organization_id!,
        agent_id: phoneNumber.agent_id,
        phone_number_id: phoneNumberId,
        call_sid: callSid,
        caller_number: from,
        called_number: to,
        routing_status: routingStatus,
        event_sequence: eventSequence,
        data: {} as unknown as Record<string, unknown>, // Will be updated by VAPI webhook
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating call record:', insertError);
      // Continue anyway - don't fail the call
    }

    // Generate TwiML based on routing decision
    if (matchingSchedule) {
      // Add routing_to_team event
      if (callRecord) {
        eventSequence.push({
          type: 'routing_to_team',
          timestamp: new Date().toISOString(),
          details: {
            schedule_id: matchingSchedule.id,
            transfer_to_number: matchingSchedule.transfer_to_number,
            dial_timeout: matchingSchedule.dial_timeout,
          },
        });

        await supabase
          .from('calls')
          .update({
            event_sequence: eventSequence,
          })
          .eq('id', callRecord.id);
      }

      // Transfer to team number
      const fallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/phone-number/${phoneNumberId}/incoming/fallback`;
      const twiml = generateTransferTwiML(
        matchingSchedule.transfer_to_number,
        matchingSchedule.dial_timeout,
        fallbackUrl,
        matchingSchedule.agent_fallback_enabled
      );

      console.log(`Call ${callSid} routed to team number ${matchingSchedule.transfer_to_number} per schedule`);
      
      return new NextResponse(twiml, {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    } else {
      // Route directly to agent - forward to VAPI
      // Add routing_to_agent event if we have a call record
      if (callRecord) {
        eventSequence.push({
          type: 'routing_to_agent',
          timestamp: new Date().toISOString(),
          details: {
            reason: 'direct_to_agent',
          },
        });

        await supabase
          .from('calls')
          .update({
            event_sequence: eventSequence,
          })
          .eq('id', callRecord.id);
      }

      const formDataToSend = new URLSearchParams();
      for (const [key, value] of formData.entries()) {
        formDataToSend.append(key, value.toString());
      }
      
      // Forward to Vapi's inbound call endpoint
      const vapiResponse = await fetch('https://api.vapi.ai/twilio/inbound_call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
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
      console.log('Vapi Twiml response:', vapiTwiml);
      console.log(`Call ${callSid} routed directly to agent ${phoneNumber.agent_id}`);
      
      // Extract control URL from TwiML if we have a call record
      if (callRecord) {
        try {
          // Parse TwiML to extract Stream URL
          // Format: <Stream url='wss://.../transport' />
          const streamUrlMatch = vapiTwiml.match(/url=['"]([^'"]+)['"]/);
          if (streamUrlMatch) {
            const streamUrl = streamUrlMatch[1];
            // Replace /transport with /control and convert wss:// to https://
            const controlUrl = streamUrl
              .replace('/transport', '/control')
              .replace(/^wss:\/\//, 'https://');
            
            console.log(`📞 Extracted control URL: ${controlUrl}`);
            
            // Update call record with control URL
            await supabase
              .from('calls')
              .update({ control_url: controlUrl })
              .eq('id', callRecord.id);
            
            // Trigger on-call-start tool execution asynchronously
            // Don't await - let it run in background
            executeOnCallStartTools(
              phoneNumber.agent_id,
              callRecord.id,
              from,
              to,
              controlUrl
            ).catch(err => {
              console.error('Error executing on-call-start tools:', err);
              // Don't fail the call if tool execution fails
            });
          } else {
            console.warn('Could not extract Stream URL from VAPI TwiML response');
          }
        } catch (error) {
          console.error('Error extracting control URL:', error);
          // Don't fail the call if URL extraction fails
        }
      }
      
      return new NextResponse(vapiTwiml, {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }
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

