import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { findMatchingSchedule } from '@/lib/call-routing';
import { getPhoneNumberById } from '@/lib/phone-numbers';
import { Twilio } from 'twilio';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: phoneNumberId } = await params;
    
    // Get the incoming FormData from Twilio
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const dialCallStatus = formData.get('DialCallStatus') as string;

    if (!callSid) {
      console.error('No CallSid in fallback request');
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Invalid request.</Say></Response>',
        {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        }
      );
    }

    // Get phone number to find agent
    const phoneNumber = await getPhoneNumberById(phoneNumberId);
    
    if (!phoneNumber || !phoneNumber.agent_id) {
      console.error(`Phone number ${phoneNumberId} not found or has no agent`);
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Unable to route call.</Say></Response>',
        {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        }
      );
    }

    const supabase = await createServiceClient();

    // Find the call record by CallSid
    const { data: callRecord, error: fetchError } = await supabase
      .from('calls')
      .select('*')
      .eq('call_sid', callSid)
      .single();

    if (fetchError || !callRecord) {
      console.error('Call record not found for CallSid:', callSid);
      // Continue anyway - try to route to agent
    }

    // Check dial status
    if (dialCallStatus === 'answered' || dialCallStatus === 'completed') {
      // Team answered - update call record and let call continue or end
      if (callRecord) {
        const eventSequence = Array.isArray(callRecord.event_sequence) 
          ? callRecord.event_sequence 
          : [];
        
        eventSequence.push({
          type: dialCallStatus === 'completed' ? 'team_call_completed' : 'team_answered',
          timestamp: new Date().toISOString(),
          details: {
            dial_status: dialCallStatus,
          },
        });

        await supabase
          .from('calls')
          .update({
            routing_status: 'completed',
            event_sequence: eventSequence,
          })
          .eq('id', callRecord.id);

        // If call completed, fetch and add Twilio cost asynchronously after response
        if (dialCallStatus === 'completed') {
          after(async () => {
            await addTwilioCostToCall(callSid, callRecord.id, phoneNumber);
          });
        }
      }

      console.log(`Call ${callSid} - team ${dialCallStatus}`);
      
      // Return empty TwiML to let call end or continue
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        }
      );
    }

    // No answer, busy, or failed - fallback to agent
    if (dialCallStatus === 'no-answer' || dialCallStatus === 'busy' || dialCallStatus === 'failed') {
      // Update call record
      if (callRecord) {
        const eventSequence = Array.isArray(callRecord.event_sequence) 
          ? callRecord.event_sequence 
          : [];
        
        eventSequence.push({
          type: 'team_no_answer',
          timestamp: new Date().toISOString(),
          details: {
            dial_status: dialCallStatus,
          },
        });

        // Check if fallback is enabled for the schedule that was used
        // Find the matching schedule to check agent_fallback_enabled
        const matchingSchedule = await findMatchingSchedule(phoneNumberId);
        const shouldFallback = matchingSchedule?.agent_fallback_enabled ?? true;

        if (shouldFallback) {
          await supabase
            .from('calls')
            .update({
              routing_status: 'team_no_answer',
              event_sequence: eventSequence,
            })
            .eq('id', callRecord.id);

          // Add routing_to_agent event before routing
          eventSequence.push({
            type: 'routing_to_agent',
            timestamp: new Date().toISOString(),
            details: {
              reason: 'team_no_answer_fallback',
            },
          });

          // Update call record with routing_to_agent event
          await supabase
            .from('calls')
            .update({
              event_sequence: eventSequence,
            })
            .eq('id', callRecord.id);

          // Route to agent - forward directly to VAPI
          // Filter out Dial-specific fields that Twilio adds (VAPI doesn't accept them)
          const formDataToSend = new URLSearchParams();
          const dialFieldsToExclude = [
            'DialCallStatus', 
            'DialCallSid', 
            'DialBridged',
            'DialCallDuration',
            'DialCallDurationUnits'
          ];
          for (const [key, value] of formData.entries()) {
            if (!dialFieldsToExclude.includes(key)) {
              formDataToSend.append(key, value.toString());
            }
          }
          
          // Also ensure CallStatus is set to 'ringing' for VAPI (not 'completed' or other statuses)
          if (formDataToSend.has('CallStatus')) {
            const currentStatus = formDataToSend.get('CallStatus');
            if (currentStatus !== 'ringing') {
              formDataToSend.set('CallStatus', 'ringing');
            }
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
          console.log(`Call ${callSid} - team no answer, falling back to agent`);
          
          return new NextResponse(vapiTwiml, {
            status: 200,
            headers: { 'Content-Type': 'text/xml' },
          });
        } else {
          // Fallback disabled - hang up
          await supabase
            .from('calls')
            .update({
              routing_status: 'team_no_answer',
              event_sequence: eventSequence,
            })
            .eq('id', callRecord.id);

          console.log(`Call ${callSid} - team no answer, fallback disabled, hanging up`);
          
          return new NextResponse(
            '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>',
            {
              status: 200,
              headers: { 'Content-Type': 'text/xml' },
            }
          );
        }
      } else {
        // No call record found, but route to agent anyway - forward directly to VAPI
        // Filter out Dial-specific fields that Twilio adds (VAPI doesn't accept them)
        const formDataToSend = new URLSearchParams();
        const dialFieldsToExclude = [
          'DialCallStatus', 
          'DialCallSid', 
          'DialBridged',
          'DialCallDuration',
          'DialCallDurationUnits'
        ];
        for (const [key, value] of formData.entries()) {
          if (!dialFieldsToExclude.includes(key)) {
            formDataToSend.append(key, value.toString());
          }
        }
        
        // Also ensure CallStatus is set to 'ringing' for VAPI (not 'completed' or other statuses)
        if (formDataToSend.has('CallStatus')) {
          const currentStatus = formDataToSend.get('CallStatus');
          if (currentStatus !== 'ringing') {
            formDataToSend.set('CallStatus', 'ringing');
          }
        }
        
        // Forward to Vapi's inbound call endpoint
        const vapiResponse = await fetch('https://api.vapi.ai/twilio/inbound_call', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formDataToSend,
        });

        console.log(`Vapi response: ${vapiResponse.status}`);

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
        
        return new NextResponse(vapiTwiml, {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }
    }

    // Unknown status - route to agent as fallback - forward directly to VAPI
    // Only route if status is NOT completed (completed means call already ended)
    if (dialCallStatus === 'completed') {
      console.log(`Call ${callSid} - dial completed, call already ended, not routing to agent`);
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        }
      );
    }
    
    console.log(`Call ${callSid} - unknown dial status: ${dialCallStatus}, routing to agent`);
    
    // Filter out Dial-specific fields that Twilio adds (VAPI doesn't accept them)
    const formDataToSend = new URLSearchParams();
    const dialFieldsToExclude = [
      'DialCallStatus', 
      'DialCallSid', 
      'DialBridged',
      'DialCallDuration',
      'DialCallDurationUnits'
    ];
    for (const [key, value] of formData.entries()) {
      if (!dialFieldsToExclude.includes(key)) {
        formDataToSend.append(key, value.toString());
      }
    }
    
    // Also ensure CallStatus is set to 'ringing' for VAPI (not 'completed' or other statuses)
    if (formDataToSend.has('CallStatus')) {
      const currentStatus = formDataToSend.get('CallStatus');
      if (currentStatus !== 'ringing') {
        formDataToSend.set('CallStatus', 'ringing');
      }
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
    
    return new NextResponse(vapiTwiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('Error handling fallback call:', error);
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred. Please try again later.</Say></Response>',
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      }
    );
  }
}

/**
 * Add Twilio cost to a call record
 */
async function addTwilioCostToCall(
  callSid: string,
  callRecordId: string,
  phoneNumber: { provider: string; credentials: { account_sid?: string; auth_token?: string } }
) {
  try {
    // Only process Twilio calls
    if (phoneNumber.provider !== 'twilio') {
      return;
    }

    const accountSid = phoneNumber.credentials.account_sid;
    const authToken = phoneNumber.credentials.auth_token;

    if (!accountSid || !authToken) {
      console.warn('Twilio credentials missing, cannot fetch cost');
      return;
    }

    // Create Twilio client
    const twilioClient = new Twilio(accountSid, authToken);

    // Fetch Twilio call data
    let call = await twilioClient.calls(callSid).fetch();

    // If no price found, wait 30 seconds and check again
    if (!call.price) {
      console.warn('No price found in Twilio call data, waiting 30 seconds and retrying...');
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
      
      // Fetch again after waiting
      call = await twilioClient.calls(callSid).fetch();
      
      if (!call.price) {
        console.warn('No price found in Twilio call data after retry');
        return;
      }
    }

    // Extract cost: convert negative price to positive
    const cost = Math.abs(parseFloat(call.price));
    const costEntry = {
      type: 'twilio',
      cost: cost,
    };

    const supabase = await createServiceClient();

    // Get current call record to check existing costs
    const { data: callRecord, error: fetchError } = await supabase
      .from('calls')
      .select('data')
      .eq('id', callRecordId)
      .single();

    if (fetchError || !callRecord) {
      console.error('Error fetching call record for cost update:', fetchError);
      return;
    }

    // Prepare updated data with costs array
    const updatedData = { ...callRecord.data };

    // Initialize or get existing costs array
    const existingCosts = Array.isArray(updatedData.costs) 
      ? updatedData.costs 
      : [];

    // Append new cost entry (avoid duplicates by checking if twilio cost already exists)
    const hasTwilioCost = existingCosts.some((c: any) => c.type === 'twilio');
    if (!hasTwilioCost) {
      existingCosts.push(costEntry);
      updatedData.costs = existingCosts;
    } else {
      // Update existing twilio cost entry
      const twilioCostIndex = existingCosts.findIndex((c: any) => c.type === 'twilio');
      if (twilioCostIndex >= 0) {
        existingCosts[twilioCostIndex] = costEntry;
      } else {
        existingCosts.push(costEntry);
      }
      updatedData.costs = existingCosts;
    }

    // Update the call record with the cost
    const { error: updateError } = await supabase
      .from('calls')
      .update({
        data: updatedData,
      })
      .eq('id', callRecordId);

    if (updateError) {
      console.error('Error updating call record with Twilio cost:', updateError);
      return;
    }

    console.log(`Twilio cost added to call record: ${cost} ${call.priceUnit || 'USD'}`);
  } catch (error) {
    console.error('Error fetching Twilio call cost:', error);
    // Don't throw - we don't want to fail the request if cost fetching fails
  }
}

