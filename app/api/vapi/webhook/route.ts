import { Vapi } from "@vapi-ai/server-sdk";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { Twilio } from "twilio";
import { createMeterEvent } from "@/lib/stripe";
import { syncOrganizationSubscriptions } from "@/lib/billing";

export async function POST(request: NextRequest) {

    const data = await request.json();
    
    const message = data.message;

    // console.log(JSON.stringify(message, null, 2));

    if (message.type === 'end-of-call-report') {
        const report = message as Vapi.ServerMessageEndOfCallReport;
        console.log(report);
        
        // Handle the end-of-call report asynchronously
        await handleEndOfCallReport(report);
    }

    return NextResponse.json({ message: 'Webhook received' });
}


async function handleEndOfCallReport(report: Vapi.ServerMessageEndOfCallReport) {
    
    const vapiAssistantId = report.call?.assistantId;

    if (!vapiAssistantId) {
        console.warn('No assistantId found in call report');
        return;
    }

    try {
        const supabase = await createServiceClient();

        // Look up the agent by vapi_assistant_id
        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('id, organization_id')
            .eq('vapi_assistant_id', vapiAssistantId)
            .single();

        if (agentError || !agent) {
            console.warn(`Agent not found for VAPI assistant ID: ${vapiAssistantId}`);
            return;
        }

        // Try to find existing call record by CallSid
        // The CallSid might be in report.call or report.phoneCallProviderId
        const callSid = (report.call as any)?.callSid || (report.call as any)?.twilioCallSid || report.call?.phoneCallProviderId;
        
        let existingCallRecord = null;
        if (callSid) {
            const { data: existingCall, error: fetchError } = await supabase
                .from('calls')
                .select('*')
                .eq('call_sid', callSid)
                .single();

            if (!fetchError && existingCall) {
                existingCallRecord = existingCall;
            }
        }

        // Prepare event sequence update
        const eventSequence = existingCallRecord && Array.isArray(existingCallRecord.event_sequence)
            ? [...existingCallRecord.event_sequence]
            : [];

        eventSequence.push({
            type: 'agent_call_completed',
            timestamp: new Date().toISOString(),
            details: report as unknown as Record<string, unknown>,
        });

        // Calculate rounded duration (round UP to nearest second)
        const durationSeconds = (report as any).durationSeconds || (report.call as any)?.duration || 0;
        const roundedDurationSeconds = durationSeconds > 0 ? Math.ceil(durationSeconds) : 0;

        // Prepare data with rounded duration
        const callData = {
            ...(report as unknown as Record<string, unknown>),
            roundedDurationSeconds: roundedDurationSeconds,
        };

        if (existingCallRecord) {
            // Update existing call record
            const { error: updateError } = await supabase
                .from('calls')
                .update({
                    data: callData,
                    event_sequence: eventSequence,
                    routing_status: 'completed',
                })
                .eq('id', existingCallRecord.id);

            if (updateError) {
                console.error('Error updating call record:', updateError);
                return;
            }

            console.log(`Call record updated for CallSid ${callSid}`);
        } else {
            // Create new call record (backward compatibility for edge cases)
            const { error: insertError } = await supabase
                .from('calls')
                .insert({
                    organization_id: agent.organization_id,
                    agent_id: agent.id,
                    call_sid: callSid || null,
                    routing_status: 'completed',
                    event_sequence: eventSequence,
                    data: callData
                });

            if (insertError) {
                console.error('Error inserting call record:', insertError);
                return;
            }

            console.log(`Call record created for agent ${agent.id}`);
        }

        await getCallTwilioCost(report, callSid, existingCallRecord?.id);

        // Send meter event for usage-based billing
        await sendMeterEventForCall(report, agent.organization_id);
        
    } catch (error) {
        console.error('Error handling end-of-call report:', error);
    }
}

async function getCallTwilioCost(
    report: Vapi.ServerMessageEndOfCallReport,
    callSid: string | null | undefined,
    callRecordId: string | undefined
) {
    try {
        const phoneCallProviderId = report.call?.phoneCallProviderId;
        const phoneNumber = report.call?.phoneNumberId;

        if (!phoneNumber || !phoneCallProviderId) {
            console.warn('No phoneNumberId or phoneCallProviderId found in call report');
            return;
        }

        if (!callSid && !callRecordId) {
            console.warn('No callSid or callRecordId provided, cannot update cost');
            return;
        }

        const supabase = await createServiceClient();

        const { data: phoneNumberData, error: phoneNumberError } = await supabase
            .from('phone_numbers')
            .select('provider, credentials')
            .eq('vapi_phone_number_id', phoneNumber)
            .single();

        if (phoneNumberError || !phoneNumberData) {
            console.warn('No phone number found in database');
            return;
        }

        // Instantiate a twilio client
        const twilioClient = new Twilio(
            phoneNumberData.credentials.account_sid,
            phoneNumberData.credentials.auth_token
        );

        // Get the twilio call cost using the id
        let call = await twilioClient.calls(phoneCallProviderId).fetch();

        // If no price found, wait 30 seconds and check again
        if (!call.price) {
            console.warn('No price found in Twilio call data, waiting 30 seconds and retrying...');
            await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
            
            // Fetch again after waiting
            call = await twilioClient.calls(phoneCallProviderId).fetch();
            
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

        // Find the call record by callSid or use provided callRecordId
        let callRecordIdToUse = callRecordId;
        if (!callRecordIdToUse && callSid) {
            const { data: callRecord, error: fetchError } = await supabase
                .from('calls')
                .select('id, data')
                .eq('call_sid', callSid)
                .single();

            if (fetchError || !callRecord) {
                console.warn('Call record not found for updating cost');
                return;
            }

            callRecordIdToUse = callRecord.id;
        }

        if (!callRecordIdToUse) {
            console.warn('No call record ID available for updating cost');
            return;
        }

        // Get current call record to check existing costs
        const { data: callRecord, error: fetchError } = await supabase
            .from('calls')
            .select('data')
            .eq('id', callRecordIdToUse)
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
            .eq('id', callRecordIdToUse);

        if (updateError) {
            console.error('Error updating call record with Twilio cost:', updateError);
            return;
        }

        console.log(`Twilio cost added to call record: ${cost} ${call.priceUnit || 'USD'}`);
    } catch (error) {
        console.error('Error fetching Twilio call cost:', error);
        // Don't throw - we don't want to fail the webhook if cost fetching fails
    }
}

async function sendMeterEventForCall(report: Vapi.ServerMessageEndOfCallReport, organizationId: string) {
    try {
        const supabase = await createServiceClient();

        // Sync subscriptions to ensure status is current
        await syncOrganizationSubscriptions(organizationId);
        
        const { data: org, error: orgError } = await supabase
            .from('organisations')
            .select('stripe_customer_id')
            .eq('id', organizationId)
            .single();

        if (orgError || !org || !org.stripe_customer_id) {
            console.log('No Stripe customer for organization, skipping meter event');
            return;
        }
        
        // Extract call duration and calculate seconds
        const durationSeconds = (report as any).durationSeconds || (report.call as any)?.duration || 0;
        
        if (durationSeconds <= 0) {
            console.warn('Invalid call duration, skipping meter event');
            return;
        }
        
        // Round UP to nearest second
        const seconds = Math.ceil(durationSeconds);
        
        console.log(`Seconds: ${seconds}`);
        
        // Get call ID for idempotency
        const callId = report.call?.id;
        if (!callId) {
            console.warn('No call ID found, skipping meter event');
            return;
        }
        
        // Send meter event
        await createMeterEvent({
            customerId: org.stripe_customer_id,
            seconds: seconds,
            callId: callId,
        });
        
        console.log(`Meter event sent: ${seconds} seconds for organization ${organizationId}`);
    } catch (error) {
        console.error('Error sending meter event:', error);
        // Don't throw - we don't want to fail the webhook if meter event fails
    }
}